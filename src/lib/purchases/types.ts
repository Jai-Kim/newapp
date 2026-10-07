/**
 * The RevenueCat entitlement identifier that gates writing a new chapter
 * (issue #14, ADR-0003). Must match the entitlement created in the
 * RevenueCat dashboard exactly.
 *
 * Reading chapters a family has already made never checks this — ADR-0003 is
 * explicit that families keep read access to books they've made, so this
 * only ever guards the "write tomorrow's chapter" action.
 */
export const PRO_ENTITLEMENT_ID = 'pro';
