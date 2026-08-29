/**
 * The parent-facing privacy/AI-disclosure copy, bilingual EN+KO.
 *
 * Mirrors `docs/privacy/privacy-en.md` and `privacy-ko.md`, which are the
 * source of record — there is no build step linking the two, so a change to
 * either must be copied by hand into the other (see `docs/privacy/README.md`).
 *
 * `PRIVACY_POLICY_VERSION` is what gets recorded against a family's consent
 * (`privacy_consents.policy_version`, migration 0009). Bump it whenever a
 * section below changes in a way that should trigger re-consent.
 */

export const PRIVACY_POLICY_VERSION = 'v1';

export type PrivacySection = {
  id: string;
  heading_en: string;
  heading_ko: string;
  body_en: string;
  body_ko: string;
};

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'ai-providers',
    heading_en: 'Your stories are written and illustrated by AI',
    heading_ko: '아이의 이야기는 AI가 쓰고 그림을 그립니다',
    body_en:
      'When you tell us what tonight’s story should be about, that text — '
      + 'together with the story details we already have about your child — '
      + 'is sent to Anthropic (the Claude models) to write the chapter, and '
      + 'to Google (the Gemini models) to illustrate it. Under our commercial '
      + 'agreements with them, neither company uses your family’s data to '
      + 'train their models. TODO(Jai): confirm this against the actual, '
      + 'executed agreement with each provider.',
    body_ko:
      '오늘 밤 이야기의 주제를 입력하시면, 그 내용과 아이에 대한 정보가 '
      + 'Anthropic(Claude 모델)로 전송되어 챕터를 작성하고, Google(Gemini 모델)'
      + '로 전송되어 그림을 그립니다. 두 회사와의 상업적 계약에 따라, 어느 회사도 '
      + '가족의 데이터를 자사 모델 학습에 사용하지 않습니다. TODO(Jai): 각 제공업체와 '
      + '실제로 체결된 계약 내용을 기준으로 다시 확인이 필요합니다.',
  },
  {
    id: 'safety-review',
    heading_en: 'Every chapter is checked before your child sees it',
    heading_ko: '모든 챕터는 아이에게 보여지기 전에 확인을 거칩니다',
    body_en:
      'Generated text and images pass through an automated content filter, '
      + 'and a parent reviews and approves or rejects every chapter before it '
      + 'becomes readable. Nothing generated is ever shown to your child '
      + 'without that step.',
    body_ko:
      '생성된 텍스트와 이미지는 자동 콘텐츠 필터를 거치며, 보호자가 직접 모든 '
      + '챕터를 검토하여 승인하거나 거절한 뒤에야 읽을 수 있게 됩니다. 이 과정 '
      + '없이는 어떤 생성물도 아이에게 보여지지 않습니다.',
  },
  {
    id: 'what-we-store',
    heading_en: 'What we store, and where',
    heading_ko: '무엇을, 어디에 저장하나요',
    body_en:
      'Your account, your child’s profile, and every chapter are stored in '
      + 'our database, hosted by Supabase. TODO(Jai): name the hosting region '
      + 'explicitly — Korean privacy law requires disclosing the destination '
      + 'country of a cross-border transfer. We do not store payment card '
      + 'numbers anywhere in this app.',
    body_ko:
      '보호자 계정, 아이의 프로필, 그리고 모든 챕터는 저희 데이터베이스에 '
      + '저장되며, Supabase가 이를 호스팅합니다. TODO(Jai): 호스팅 지역을 명확히 '
      + '기재해야 합니다 — 한국 개인정보보호법은 국외 이전 시 이전받는 국가를 '
      + '명시하도록 요구합니다. 이 앱은 결제 카드 번호를 어디에도 저장하지 '
      + '않습니다.',
  },
  {
    id: 'retention',
    heading_en: 'How long we keep it',
    heading_ko: '보관 기간',
    body_en:
      'TODO(Jai): no retention period has been decided yet. This section '
      + 'needs a concrete answer before this notice can be considered '
      + 'complete.',
    body_ko:
      'TODO(Jai): 보관 기간이 아직 결정되지 않았습니다. 이 항목이 완성되려면 '
      + '구체적인 답변이 필요합니다.',
  },
  {
    id: 'deletion',
    heading_en: 'Deleting a child’s profile',
    heading_ko: '아이 프로필 삭제',
    body_en:
      'You can ask us to delete a child’s profile and every chapter '
      + 'written for them. TODO(Jai): a contact address and an actual '
      + 'deletion process do not exist yet.',
    body_ko:
      '아이의 프로필과 관련된 모든 챕터의 삭제를 요청하실 수 있습니다. '
      + 'TODO(Jai): 문의처와 실제 삭제 절차가 아직 마련되지 않았습니다.',
  },
  {
    id: 'contact',
    heading_en: 'Who to contact',
    heading_ko: '문의처',
    body_en:
      'TODO(Jai): this app does not yet have a published legal entity name, '
      + 'address, or a named privacy contact (Korea PIPA requires a '
      + 'designated data protection officer, 개인정보보호책임자, for a service '
      + 'handling a child’s personal data).',
    body_ko:
      'TODO(Jai): 법인명, 주소, 개인정보 담당 연락처가 아직 마련되지 않았습니다 '
      + '(한국 개인정보보호법은 아동의 개인정보를 처리하는 서비스에 이름과 연락처가 '
      + '명시된 개인정보보호책임자를 지정하도록 요구합니다).',
  },
];
