import { CRISIS_RESOURCES } from "./crisis-resources";
import {
  buildScreeningText,
  CrisisDetectedError,
  interpretCrisisVerdict,
  type RawCrisisVerdict,
  SENSITIVE_TOPIC_DISCLAIMER,
} from "./crisis-response";

/**
 * What this file does and does not cover.
 *
 * `interpretCrisisVerdict` is pure and fully testable: given a parsed model
 * verdict (or a refusal), does the code make the right, deterministic
 * decision? That is what every test below exercises.
 *
 * What it cannot exercise is whether the real model, given a specific piece
 * of Korean or English text, would actually produce that verdict — that
 * requires a live call to Claude, which this sandbox has neither network
 * access nor an API key to make (crisis.ts, which makes that call, also
 * cannot be loaded by Jest at all: it imports the Anthropic SDK via a Deno
 * `npm:` specifier, same as safety.ts, which has no unit test for the same
 * reason). Each test below is written against a *realistic* example of
 * crisis or near-miss phrasing in both languages, with the verdict a
 * correctly-tuned model should produce for it — so this documents the
 * intended behaviour and exercises the code path that acts on it, but a
 * human still needs to spot-check the live model against phrasing like this
 * before launch (see the PR description).
 */

function verdict(partial: Partial<RawCrisisVerdict>): RawCrisisVerdict {
  return { signal: "none", category: "none", reasoning: "", ...partial };
}

describe("buildScreeningText", () => {
  const PRESETS = new Set(["being brave about something new", "asking for help"]);

  it("returns null when there is nothing to screen", () => {
    expect(buildScreeningText({}, PRESETS)).toBeNull();
  });

  it("skips a lesson that exactly matches a known-safe preset — the picker never sends anything else", () => {
    expect(buildScreeningText({ lesson: "being brave about something new" }, PRESETS))
      .toBeNull();
  });

  it("still screens a situation even when the lesson is a safe preset", () => {
    const text = buildScreeningText(
      { lesson: "being brave about something new", situation: "first swim lesson" },
      PRESETS,
    );
    expect(text).toContain("first swim lesson");
    expect(text).not.toContain("Requested topic");
  });

  it("screens a lesson that does NOT match any preset, as free text", () => {
    // Only reachable by calling the API directly — the app's own picker only
    // ever sends one of the fixed presets — but the API doesn't know that.
    const text = buildScreeningText({ lesson: "something the picker never offers" }, PRESETS);
    expect(text).toContain("something the picker never offers");
  });

  it("combines both fields when both are free text", () => {
    const text = buildScreeningText(
      { lesson: "an unlisted topic", situation: "a described situation" },
      PRESETS,
    );
    expect(text).toContain("an unlisted topic");
    expect(text).toContain("a described situation");
  });
});

describe("interpretCrisisVerdict", () => {
  it("fails closed on a screener refusal, with no category to report", () => {
    const result = interpretCrisisVerdict(verdict({}), true);
    expect(result).toEqual({
      blocked: true,
      category: null,
      reasoning: "crisis screener declined to assess this input",
    });
  });

  it("blocks on a crisis signal and carries the category through", () => {
    const result = interpretCrisisVerdict(
      verdict({ signal: "crisis", category: "abuse", reasoning: "disclosure of abuse" }),
      false,
    );
    expect(result).toEqual({ blocked: true, category: "abuse", reasoning: "disclosure of abuse" });
  });

  it("still blocks a crisis signal even if category came back malformed as none", () => {
    // A model that says "crisis" but fails to categorise it is a malformed
    // response, not a green light — fail closed rather than let it through.
    const result = interpretCrisisVerdict(verdict({ signal: "crisis", category: "none" }), false);
    expect(result.blocked).toBe(true);
    expect(result.category).toBeNull();
  });

  it("does not block a none signal", () => {
    const result = interpretCrisisVerdict(
      verdict({ signal: "none", category: "none", reasoning: "a routine hospital visit" }),
      false,
    );
    expect(result).toEqual({
      blocked: false,
      category: null,
      reasoning: "a routine hospital visit",
    });
  });

  describe("representative phrasing this screener is designed to catch", () => {
    // English
    it.each<[string, RawCrisisVerdict["category"], string]>([
      [
        "her uncle touches her at night and she’s scared to be alone with him",
        "abuse",
        "disclosure of possible abuse",
      ],
      [
        "I keep thinking I don’t want to be alive anymore",
        "self_harm",
        "parent describing suicidal ideation",
      ],
      [
        "my son’s dad died three days ago and none of us know how to cope",
        "acute_grief",
        "very recent death in the immediate family",
      ],
      [
        "his father is hitting me right now and I don’t know what to do",
        "acute_danger",
        "ongoing violence in the home",
      ],
    ])("EN crisis: %s", (_situation, category, reasoning) => {
      const result = interpretCrisisVerdict(verdict({ signal: "crisis", category, reasoning }), false);
      expect(result.blocked).toBe(true);
      expect(result.category).toBe(category);
    });

    // Korean, screened with equal rigour, not a weaker keyword pass
    it.each<[string, RawCrisisVerdict["category"], string]>([
      [
        "삼촌이 밤마다 아이 방에 들어와서 아이가 무서워해요",
        "abuse",
        "possible abuse disclosure in Korean",
      ],
      [
        "요즘 제가 사는 게 너무 힘들어서 그만 살고 싶다는 생각이 들어요",
        "self_harm",
        "parent's own suicidal ideation in Korean",
      ],
      [
        "어제 아이 아빠가 갑자기 돌아가셔서 온 가족이 힘들어하고 있어요",
        "acute_grief",
        "very recent death in the immediate family, in Korean",
      ],
      [
        "지금 집에서 아빠가 엄마를 때리고 있어요, 무서워요",
        "acute_danger",
        "ongoing violence in the home, in Korean",
      ],
    ])("KO crisis: %s", (_situation, category, reasoning) => {
      const result = interpretCrisisVerdict(verdict({ signal: "crisis", category, reasoning }), false);
      expect(result.blocked).toBe(true);
      expect(result.category).toBe(category);
    });
  });

  describe("representative near-miss phrasing that must still generate", () => {
    // These are the app's core purpose (safety.ts's own SYSTEM prompt says
    // as much for output review) — over-blocking these would break the
    // product, so each one asserts blocked === false.
    it.each<string>([
      "first swim lesson tomorrow and she’s nervous",
      "our dog died last week and he’s sad about it",
      "we just told her we’re getting divorced",
      "starting kindergarten on Monday, feeling shy",
      "she’s scared of the dark at night",
    ])("EN near-miss: %s", (situation) => {
      const result = interpretCrisisVerdict(
        verdict({ signal: "none", category: "none", reasoning: situation }),
        false,
      );
      expect(result.blocked).toBe(false);
    });

    it.each<string>([
      "내일 병원에 가서 예방접종을 맞아요",
      "키우던 금붕어가 죽어서 슬퍼해요",
      "요즘 부모님이 별거를 시작해서 혼란스러워해요",
      "다음 주에 새 학교에 가는데 긴장하고 있어요",
      "밤에 어두운 걸 무서워해요",
      "몇 년 전에 할머니가 돌아가셨는데 아직도 가끔 그리워해요",
    ])("KO near-miss: %s", (situation) => {
      const result = interpretCrisisVerdict(
        verdict({ signal: "none", category: "none", reasoning: situation }),
        false,
      );
      expect(result.blocked).toBe(false);
    });
  });
});

describe("crisisDetectedError", () => {
  it("carries a machine-readable code, bilingual copy, and the full resource list", () => {
    const err = new CrisisDetectedError("self_harm");
    expect(err.status).toBe(422);
    expect(err.code).toBe("crisis_detected");
    expect(err.category).toBe("self_harm");
    expect(err.messageEn).toMatch(/storyloom writes bedtime stories/i);
    expect(err.messageKo).toContain("Storyloom은 잠자리 동화를 쓰는");
    expect(err.resources).toEqual(CRISIS_RESOURCES);
  });

  it("never implies anyone was contacted, and never promises confidentiality", () => {
    const err = new CrisisDetectedError("abuse");
    const combined = `${err.messageEn} ${err.messageKo}`;
    expect(combined).not.toMatch(/contact(ed)?|notified|reported|알렸|신고했/i);
    expect(combined).not.toMatch(/confidential|private|비밀|기밀/i);
  });

  it("carries a category of null for an unresolvable (refused) screening", () => {
    const err = new CrisisDetectedError(null);
    expect(err.category).toBeNull();
    // Still gets the same warm, resourceful response — a refusal is not
    // treated any differently from the family's point of view.
    expect(err.resources.length).toBeGreaterThan(0);
  });

  it("toBody() carries the code, both languages, the disclaimer, and resources", () => {
    const err = new CrisisDetectedError("acute_danger");
    expect(err.toBody()).toEqual({
      ok: false,
      code: "crisis_detected",
      category: "acute_danger",
      error: err.messageEn,
      message_en: err.messageEn,
      message_ko: err.messageKo,
      disclaimer_en: SENSITIVE_TOPIC_DISCLAIMER.en,
      disclaimer_ko: SENSITIVE_TOPIC_DISCLAIMER.ko,
      resources: CRISIS_RESOURCES,
    });
  });
});

describe("crisis resources data", () => {
  it("includes the Korea and US lines the issue asked for by name", () => {
    const contacts = CRISIS_RESOURCES.map(r => r.contact);
    expect(contacts).toEqual(expect.arrayContaining(["109", "112", "988"]));
  });

  it("gives every resource both languages", () => {
    for (const resource of CRISIS_RESOURCES) {
      expect(resource.name_en.length).toBeGreaterThan(0);
      expect(resource.name_ko.length).toBeGreaterThan(0);
      expect(resource.note_en.length).toBeGreaterThan(0);
      expect(resource.note_ko.length).toBeGreaterThan(0);
    }
  });
});
