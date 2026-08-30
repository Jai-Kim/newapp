# Play closed-test tester onboarding (issue #11)

**Status: engineering draft for review.** The recruiting message and tester
instructions below are bilingual EN+KO and ready to paste, but the Korean
has not been checked by a native-speaker reviewer — same standing as `docs/
privacy-policy.md`. The opt-in URL referenced throughout is a placeholder
until the closed-testing track exists (`docs/play-closed-testing.md`).

Google's rule (as best understood — see `docs/play-closed-testing.md` for
the full caveat) needs **12 testers opted in concurrently for 14 continuous
days**. The tracker at the bottom of this file exists to make that count
and that clock visible at a glance.

---

## For Jai: recruiting message (paste into a chat)

Fill in `[OPT-IN LINK]` once the closed-testing track exists in Play
Console (`docs/play-closed-testing.md`, step 4).

### English

> Hey! I've been building a bedtime-story app called Storyloom — it writes
> and illustrates a story starring your kid, in English and Korean, and it
> remembers what happened last time. I'm about to submit it to the Play
> Store, and Google requires a small closed test first. Would you be up for
> trying it out on Android for a couple of weeks?
>
> It's free, it's an early build (expect rough edges), and you can stop any
> time — I just need you to opt in and keep the app installed for about 14
> days. Steps: [OPT-IN LINK] → tap "Become a tester" → install from the Play
> Store link on that page. Thank you!! 🙏

### 한국어

> 안녕하세요! 제가 요즘 Storyloom이라는 잠자리 동화 앱을 만들고 있어요 —
> 아이가 주인공인 동화를 영어와 한국어로 써주고 그림도 그려주는데, 지난
> 이야기를 기억해서 이어가요. 곧 플레이스토어에 제출하려고 하는데, 그전에
> 구글이 요구하는 소규모 비공개 테스트를 먼저 해야 해요. 2주 정도
> 안드로이드에서 테스트해 주실 수 있을까요?
>
> 무료이고, 아직 초기 버전이라 다듬어지지 않은 부분이 있을 수 있어요.
> 언제든 그만두셔도 괜찮아요 — 다만 약 14일 동안은 참여 등록을 하고 앱을
> 설치한 상태로 유지해 주시면 돼요. 참여 방법: [OPT-IN LINK] 접속 → "테스터
> 되기" 탭 → 해당 페이지의 플레이스토어 링크로 설치. 감사합니다!! 🙏

---

## For testers: how to opt in and install

### English

1. Open this link on the Android phone you'll test with: [OPT-IN LINK].
2. Tap **"Become a tester"** and accept.
3. Tap the Play Store link on that same page and install Storyloom like any
   other app.
4. Open the app once, so it counts as an active install — you don't need to
   finish setting up a child profile right away.
5. Please keep the app installed for about **14 days**. If you need to
   uninstall early, let Jai know — every tester dropping out risks resetting
   the whole group's clock.
6. Found something broken or confusing? Tell Jai directly — this build is
   expected to have rough edges.

### 한국어

1. 테스트에 사용하실 안드로이드 폰에서 이 링크를 열어주세요: [OPT-IN LINK]
2. **"테스터 되기"**를 눌러 동의해 주세요.
3. 같은 페이지의 플레이스토어 링크를 눌러 다른 앱처럼 Storyloom을
   설치해 주세요.
4. 설치 후 앱을 한 번 열어주세요 — 실제 설치로 인정되려면 필요해요. 아이
   프로필을 바로 다 만드실 필요는 없어요.
5. 약 **14일** 동안 앱을 삭제하지 말고 유지해 주시면 감사하겠습니다. 일찍
   삭제해야 할 경우 Jai에게 알려주세요 — 한 분이라도 빠지면 전체 그룹의
   기간이 다시 시작될 수 있어요.
6. 이상하거나 잘 안 되는 부분을 발견하시면 Jai에게 바로 알려주세요 — 아직
   다듬어지지 않은 초기 빌드예요.

---

## Tracker — 12 concurrent opted-in testers, 14 continuous days

Fill in as testers respond. The 14-day clock starts on the date the **12th**
concurrently-opted-in tester joins, not from track creation — recompute
"Clock start" once the 12th row goes green.

| # | Name | Contact | Invited | Opted in | Installed & opened | Notes |
|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |
| 11 |  |  |  |  |  |  |
| 12 |  |  |  |  |  |  |

**Clock start (date of the 12th opt-in):** `TODO(Jai)`
**Earliest possible production-access date (+14 days):** `TODO(Jai)`

## Open items — `TODO(Jai)`

- Replace every `[OPT-IN LINK]` placeholder once the closed-testing track
  exists.
- Recruit past 12 if possible — a small buffer absorbs one dropout without
  resetting the clock, per the reset-condition caveat in `docs/
  play-closed-testing.md`.
- Native-speaker review of the Korean recruiting message and instructions.
