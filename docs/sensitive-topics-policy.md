# Sensitive-topic & crisis-input policy

**Status: engineering draft for review — not legally cleared.** Companion to
`docs/privacy-policy.md`, with the same standing: written in plain language on
purpose, and anywhere a specific fact or threshold is missing it is marked
`TODO(Jai)` rather than invented.

This document is the source of record for two things the app does at the
point a parent types a situation for tonight's chapter:

1. A **disclaimer** (`SENSITIVE_TOPIC_DISCLAIMER` in
   `supabase/functions/_shared/crisis-response.ts` and
   `src/features/legal/sensitive-topic-content.ts`) shown next to the
   situation field at all times.
2. A **screener** (`supabase/functions/_shared/crisis.ts`) that runs on every
   `lesson`/`situation` before generation, and — if it recognises a clear
   crisis signal — stops before anything is generated or spent, and shows a
   warm, bilingual response with real resources instead.

---

## English

### Why this exists

Storyloom turns whatever a parent types into a bedtime story. Almost always
that is exactly right — a scary hospital visit, a pet dying, a new school, a
divorce, a child's ordinary fear of the dark are precisely what a gentle
story can help with, and the app should say yes to all of them.

A small number of things are not story material. If a parent discloses
possible abuse of their child, describes thoughts of suicide or self-harm, is
in the middle of a very recent death in the family, or describes danger
happening in the home right now, turning that into a bedtime story is not
just unhelpful — the output-safety review (`_shared/safety.ts`) checks
*generated* text and pictures for content unsuitable for a child, not for
whether the input was a disclosure that needs a different kind of help
entirely, so without something on the input side, a disclosure like this
could otherwise become a story about it.

### What happens when the screener recognises a crisis signal

- No chapter is generated. No provider is spent. No allowance slot (issue #6)
  is consumed.
- The parent sees a bilingual (English + Korean) message that:
  - acknowledges what they wrote, without repeating a diagnosis-shaped label
    back at them ("abuse", "self-harm") — the app is not qualified to
    diagnose anything;
  - says plainly that Storyloom writes bedtime stories and this is not the
    right tool for what was described;
  - lists real, named resources to contact instead.
- The message never says or implies that anyone has been contacted on the
  family's behalf, and never promises confidentiality — neither is true, and
  promising either would be actively misleading in a moment that matters.

### The disclaimer

Shown next to the situation field at all times, not only after something is
blocked:

> Storyloom writes bedtime stories. It is not medical, psychological, or
> therapeutic advice, and it is not a crisis service.

### How the screener decides

A model call, in the same style as the existing output-safety review, reads
the `lesson` and `situation` text — in whichever language the parent typed,
English or Korean or both — and looks for a clear, concrete signal of:

- **abuse** — disclosure or strong suspicion of physical, sexual, or
  emotional abuse, or neglect, of the child
- **self_harm** — the parent or the child having thoughts of suicide or of
  hurting themselves, now or recently
- **acute_grief** — a death in the immediate family that is fresh and raw,
  described as a crisis the family is currently in — not a story request
  that simply involves loss as a theme
- **acute_danger** — violence happening in the home, or a child in danger
  right now

It is deliberately biased toward **not** flagging: a hospital visit, an
illness, a pet dying, a divorce, starting a new school, ordinary fear or
sadness, and grief being processed as a story theme (rather than described as
an unfolding crisis) must all still generate a story, because that is what
the app is for. Over-blocking gentle sadness would cost a family their
night's chapter and a moment of feeling judged for something ordinary.

**TODO(Jai):** the boundary drawn for `acute_grief` above is a judgement
call, and it sits in tension with `_shared/safety.ts`'s own stance that "a
death in the family... handled with honesty and warmth" is the app's *core
purpose* on the output side. The distinction this policy draws is
acuteness — a death from days ago that the family is currently in the middle
of, versus loss as a story theme — but that line has not been reviewed by
you or tested against real phrasing from a live model. Please read the
system prompt in `crisis.ts` and confirm the line is in the right place
before launch.

### What this does not do

- It does not diagnose, counsel, or triage. It recognises a small number of
  clear signals and hands off to a human resource.
- It does not contact anyone on the family's behalf.
- It is not a mandatory-reporting mechanism. **TODO(Jai):** if Korean or US
  law creates a mandatory-reporting obligation that applies to Storyloom as
  an app operator, that is a legal question this draft does not attempt to
  answer.
- It has not been verified against a real model call in this environment (no
  network access, no API key in the build sandbox) — the classification
  logic is unit-tested against simulated verdicts
  (`supabase/functions/_shared/crisis-response.test.ts`), but the model's
  actual judgement on real phrasing needs a human spot-check before launch.

### Resources shown to a family

See `supabase/functions/_shared/crisis-resources.ts` for the current list
(Korea: 자살예방상담전화 109, 아동학대 신고 112; US: 988). **TODO(Jai):**
confirm each number is current, and add any other region you want covered —
this only has Korea and the US today.

---

## 한국어

### 왜 이 정책이 필요한가요

Storyloom은 부모님이 입력한 내용을 동화로 만들어요. 대부분의 경우 이것은
정확히 맞는 방식이에요 — 무서운 병원 방문, 반려동물의 죽음, 새 학교, 이혼,
아이의 평범한 어둠에 대한 두려움 같은 것들은 부드러운 이야기가 도움이 될 수
있는 바로 그런 상황이고, 앱은 이런 요청에 응답해야 해요.

다만 극히 일부의 내용은 이야기로 만들 소재가 아니에요. 부모님이 아이에 대한
학대 가능성을 알려주시거나, 자살이나 자해 생각을 이야기하시거나, 최근에
가족 중 누군가가 돌아가셔서 힘든 상황이거나, 지금 집에서 위험한 상황이
벌어지고 있다고 설명하신다면, 그것을 동화로 만드는 것은 도움이 되지 않는
정도가 아니에요 — 결과물 안전 검토(`_shared/safety.ts`)는 *생성된* 글과
그림이 아이에게 적절한지를 확인할 뿐, 입력 내용이 전혀 다른 종류의 도움이
필요한 고백인지는 확인하지 않기 때문에, 입력 단계에서 아무런 장치가 없다면
이런 고백이 그대로 그 내용에 대한 이야기가 될 수 있어요.

### 위기 신호가 감지되면 어떤 일이 일어나나요

- 챕터가 생성되지 않아요. 제공업체 비용도 발생하지 않아요. 이용 한도(이슈
  #6)도 차감되지 않아요.
- 부모님께는 영어와 한국어 둘 다로 된 메시지가 표시되며, 이 메시지는:
  - 적어주신 내용을 인정하되, "학대", "자해" 같은 진단적인 표현을 그대로
    돌려드리지 않아요 — 앱은 어떤 것도 진단할 자격이 없어요;
  - Storyloom은 잠자리 동화를 쓰는 서비스이고, 지금 설명하신 상황에는 맞는
    도구가 아니라는 것을 분명히 말해요;
  - 대신 연락할 수 있는 실제 연락처를 안내해요.
- 이 메시지는 누군가에게 대신 연락했다고 말하거나 암시하지 않으며, 비밀을
  지켜드리겠다고 약속하지도 않아요 — 둘 다 사실이 아니고, 중요한 순간에
  그렇게 약속하는 것은 오해를 불러일으킬 수 있어요.

### 안내 문구

상황 입력란 옆에 항상 표시돼요 — 무언가가 차단된 후에만 나타나는 것이 아니에요:

> Storyloom은 잠자리 동화를 쓰는 서비스예요. 의료, 심리, 치료 상담이
> 아니며, 위기 상담 서비스도 아니에요.

### 판단 방식

기존 결과물 안전 검토와 같은 방식의 모델 호출이 `lesson`과 `situation`
텍스트를 — 영어든 한국어든 혹은 둘 다든 — 읽고 다음의 명확하고 구체적인
신호가 있는지 확인해요:

- **학대(abuse)** — 아이에 대한 신체적, 성적, 정서적 학대 또는 방임의
  고백이나 강한 의심
- **자해(self_harm)** — 부모님이나 아이가 지금 또는 최근에 자살이나 자해에
  대한 생각을 하고 있음
- **급성 애도(acute_grief)** — 최근에, 그리고 아직 생생하게 힘든 직계
  가족의 죽음이 가족이 현재 겪고 있는 위기로 설명되는 경우 — 상실이
  단순히 이야기 소재로 언급되는 경우는 해당하지 않아요
- **급성 위험(acute_danger)** — 지금 집에서 폭력이 벌어지고 있거나, 아이가
  당장 위험한 상황

이 판단은 의도적으로 신호를 **잘못 감지하지 않는 쪽**으로 치우쳐 있어요:
병원 방문, 질병, 반려동물의 죽음, 이혼, 새 학교 시작, 평범한 두려움이나
슬픔, 그리고 (진행 중인 위기가 아니라) 이야기 소재로 다뤄지는 상실은 모두
여전히 이야기로 만들어져야 해요 — 그것이 이 앱이 존재하는 이유니까요.
부드러운 슬픔까지 과도하게 차단하면 그 가족은 그날 밤의 챕터를 잃고,
평범한 일로 판단받았다는 느낌까지 받게 돼요.

**Jai 확인 필요:** 위의 `acute_grief` 경계는 판단이 필요한 부분이며,
`_shared/safety.ts` 자체가 결과물 검토에서 "가족의 죽음... 정직하고 따뜻하게
다뤄진 경우"를 앱의 *핵심 목적*으로 보는 입장과 긴장 관계에 있어요. 이
정책이 그리는 구분선은 급성 정도예요 — 며칠 전에 일어나 가족이 한창 겪고
있는 죽음인지, 아니면 이야기 소재로서의 상실인지 — 하지만 이 경계는 아직
당신이나 실제 모델의 판단으로 검토되지 않았어요. 출시 전에 `crisis.ts`의
시스템 프롬프트를 읽고 경계가 적절한 위치에 있는지 확인해 주세요.

### 이 기능이 하지 않는 일

- 진단, 상담, 위기 분류를 하지 않아요. 명확한 신호 몇 가지를 인식하고
  사람이 제공하는 도움으로 안내할 뿐이에요.
- 가족을 대신해 누군가에게 연락하지 않아요.
- 의무 신고 메커니즘이 아니에요. **Jai 확인 필요:** 한국이나 미국 법이
  Storyloom과 같은 앱 운영자에게 의무 신고 의무를 부과하는지는 이 초안이
  다루지 않는 법률적 질문이에요.
- 이 빌드 환경에서는 실제 모델 호출로 검증되지 않았어요(네트워크 접근과
  API 키가 없음) — 판단 로직은 시뮬레이션된 결과에 대해 단위 테스트가
  되어 있지만(`supabase/functions/_shared/crisis-response.test.ts`), 실제
  문구에 대한 모델의 실제 판단은 출시 전에 사람이 직접 확인해야 해요.

### 가족에게 안내되는 연락처

현재 목록은 `supabase/functions/_shared/crisis-resources.ts`를 참고하세요
(한국: 자살예방상담전화 109, 아동학대 신고 112; 미국: 988). **Jai 확인
필요:** 각 번호가 현재 유효한지 확인하고, 원하시는 다른 지역이 있다면
추가해 주세요 — 현재는 한국과 미국만 포함되어 있어요.
