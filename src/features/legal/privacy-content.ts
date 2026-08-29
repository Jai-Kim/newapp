/**
 * In-app privacy/AI-use notice content (issue #12).
 *
 * Hand-kept mirror of `docs/legal/privacy-en.md` / `privacy-ko.md`, which are
 * the source of record — see `docs/legal/README.md`. There is no build step
 * that generates one from the other; if you edit the docs, edit this too.
 *
 * `PRIVACY_NOTICE_VERSION` is what gets stamped onto a child's
 * `privacy_consent_version` at setup (0009_privacy_consent.sql). Bump it any
 * time a change here would need a parent to re-consent, per the "Changes to
 * this notice" section below.
 */

export const PRIVACY_NOTICE_VERSION = '1';

export type PrivacySection = {
  id: string;
  title_en: string;
  title_ko: string;
  body_en: string;
  body_ko: string;
};

// Placeholders a tired parent can't be expected to fill in themselves — see
// docs/legal/README.md items 1 and 3 for what Jai needs to confirm.
export const LEGAL_ENTITY_NAME_PLACEHOLDER = '[Legal entity name — TBD]';
export const DPO_CONTACT_PLACEHOLDER = '[Privacy contact — TBD]';

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'what-we-collect',
    title_en: 'What we collect',
    title_ko: '수집하는 정보',
    body_en:
      'From you: your email (to sign in), and whatever you type when setting '
      + 'up a chapter — a lesson, or a real situation your family is going '
      + 'through. That goes straight into the story your child reads, and to '
      + 'the AI providers below. About your child, from you: first name, an '
      + 'age band, which language leads their stories, and a few interests — '
      + 'no birthdate, no photo of their real face. If you order a printed '
      + 'book: a recipient name and shipping address. No payment details are '
      + 'ever collected in the app.',
    body_ko:
      '부모님으로부터: 로그인을 위한 이메일 주소, 그리고 챕터를 만들 때 '
      + '입력하시는 내용 — 오늘의 교훈이나 우리 가족이 실제로 겪고 있는 '
      + '상황입니다. 이는 아이가 읽을 이야기와 아래 AI 제공업체에 그대로 '
      + '전달됩니다. 아이에 대해서는: 이름, 연령대, 먼저 표시될 언어, '
      + '관심사 몇 가지만 입력하시며 생년월일이나 실제 얼굴 사진은 요청하지 '
      + '않습니다. 인쇄본을 주문하시면 수령인 이름과 배송 주소를 받습니다. '
      + '결제 정보는 앱에서 전혀 수집하지 않습니다.',
  },
  {
    id: 'third-party-ai',
    title_en: 'Third-party AI providers',
    title_ko: '제3자 AI 제공업체',
    body_en:
      'Every chapter is written and illustrated by third-party AI APIs — '
      + 'currently Anthropic (Claude) for the text, and Google (Gemini) for '
      + `the illustrations. What you typed, and enough of your child's `
      + 'story history for continuity, is sent to these providers as a '
      + 'prompt to produce each chapter. Your device never talks to them '
      + 'directly — only our servers do, and API keys stay server-side. '
      + 'Every chapter is screened by an independent safety filter in both '
      + 'languages, and a parent must approve it, before a child ever sees '
      + 'it.',
    body_ko:
      '모든 챕터는 제3자 AI API가 작성하고 그립니다 — 현재 텍스트는 '
      + 'Anthropic(Claude), 삽화는 Google(Gemini)을 사용합니다. 입력하신 '
      + '내용과 이야기의 연속성을 위한 이전 기록 일부가 프롬프트로 전송되어 '
      + '챕터를 생성합니다. 사용자의 기기는 이 업체들과 직접 통신하지 '
      + '않으며, 오직 저희 서버만 통신하고 API 키는 서버에만 보관됩니다. '
      + '모든 챕터는 두 언어 각각에 대해 독립된 안전 필터의 검수를 거치며, '
      + '부모님이 승인해야만 아이가 읽을 수 있습니다.',
  },
  {
    id: 'cross-border',
    title_en: 'Cross-border transfer',
    title_ko: '국외 이전',
    body_en:
      'Because those AI providers are US-based, your prompts and your '
      + `child's generated content leave Korea and are processed in the `
      + `United States as part of every chapter's generation.`,
    body_ko:
      '위 AI 제공업체들은 미국에 소재하므로, 매 챕터 생성 시 입력하신 '
      + '내용과 아이를 위해 생성된 콘텐츠는 대한민국 밖으로 이전되어 '
      + '미국에서 처리됩니다.',
  },
  {
    id: 'childrens-data',
    title_en: `Children's personal data & consent`,
    title_ko: '아동의 개인정보와 동의',
    body_en:
      `Korea's Personal Information Protection Act (PIPA) requires separate, `
      + 'explicit consent from a parent or legal guardian to collect a '
      + `child's personal information — not just agreeing to terms of `
      + 'service. We capture that consent when you, the signed-in parent, '
      + `set up your child's profile, and record when you gave it and which `
      + 'version of this notice you agreed to.',
    body_ko:
      '개인정보 보호법(PIPA)은 아동의 개인정보를 수집하기 위해 이용약관에 '
      + '대한 일반 동의가 아닌, 법정대리인의 별도의 명시적 동의를 '
      + '요구합니다. 로그인된 부모님이 아이의 프로필을 설정하실 때 이 '
      + '동의를 받으며, 동의 시점과 동의하신 안내문 버전을 기록합니다.',
  },
  {
    id: 'ai-labeling',
    title_en: 'AI-generated content, labeled',
    title_ko: 'AI 생성 콘텐츠 표시',
    body_en:
      `Every chapter's text and every illustration is made by AI on your `
      + `family's behalf, reviewed by a parent, then shown to a child. `
      + `You'll see a "Made with AI" label wherever a chapter is shown.`,
    body_ko:
      '이 앱의 모든 챕터 본문과 삽화는 AI가 우리 가족을 위해 생성한 것이며, '
      + '부모님의 검토를 거쳐 아이에게 보여집니다. 챕터가 표시되는 곳에서는 '
      + '"AI로 제작됨" 표시를 확인하실 수 있습니다.',
  },
  {
    id: 'what-we-dont-do',
    title_en: 'What we do NOT do',
    title_ko: '저희가 하지 않는 일',
    body_en:
      `We do not sell your family's data, show your child ads, or use your `
      + `family's data to train our own models.`,
    body_ko:
      '가족의 정보를 판매하지 않고, 아이에게 광고를 보여주지 않으며, '
      + '가족의 정보를 저희 자체 모델 학습에 사용하지 않습니다.',
  },
  {
    id: 'your-rights',
    title_en: 'Your rights',
    title_ko: '이용자의 권리',
    body_en:
      'You can ask us to show you what we hold about your family, correct '
      + `it, or delete it, by contacting ${DPO_CONTACT_PLACEHOLDER}.`,
    body_ko:
      '가족에 대해 저희가 보유한 정보의 열람, 정정, 삭제를 '
      + `${DPO_CONTACT_PLACEHOLDER}으로 요청하실 수 있습니다.`,
  },
];

/**
 * The exact statement a parent affirms by checking the consent box at child
 * setup. Kept short enough to actually be read; the full notice above (and
 * docs/legal/) carries the detail it summarizes.
 */
export const CONSENT_STATEMENT_EN
  = `I am this child's parent or legal guardian. I've read the privacy `
    + 'notice above, including that prompts and generated content are '
    + `processed by third-party AI providers, and I consent to my child's `
    + 'information being collected and used as described.';

export const CONSENT_STATEMENT_KO
  = '저는 이 아이의 부모 또는 법정대리인입니다. 위 개인정보 안내문(입력 '
    + '내용과 생성된 콘텐츠가 제3자 AI 제공업체에서 처리된다는 내용 포함)을 '
    + '읽었으며, 안내된 대로 아이의 정보가 수집·이용되는 것에 동의합니다.';
