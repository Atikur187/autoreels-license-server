/**
 * AutoReels Scroll — Subscription Access & Entitlement Helper
 * 
 * Rules:
 * 1. Treat 'active' AND 'trialing' as access-granting.
 * 2. Do NOT revoke access just because a `scheduled_change` to cancel or pause exists
 *    — only revoke when `status` is actually 'canceled'.
 * 3. 'paused' and 'past_due' do NOT grant paid access (unless past_due is within an active grace period).
 * 4. 'canceled' immediately terminates access.
 */

/**
 * Checks whether a given subscription object currently grants paid access.
 * 
 * @param {object} subscription - The subscription record from the database or Paddle event
 * @returns {boolean} true if subscription currently grants paid access, false otherwise
 */
export function hasSubscriptionAccess(subscription) {
  if (!subscription) return false;

  const status = (subscription.status || '').toLowerCase().trim();

  // Active and trialing subscriptions grant access
  if (status === 'active' || status === 'trialing') {
    // CRITICAL RULE: A scheduled change (e.g. action: 'cancel' or 'pause') means
    // cancellation or pause takes effect at the end of the billing cycle (effective_at).
    // Access must NOT be revoked early while status is still active or trialing.
    return true;
  }

  // All other statuses ('canceled', 'paused', 'past_due') do not grant access
  return false;
}

/**
 * Returns structured subscription access details including status, access flag,
 * and scheduled change warnings.
 * 
 * @param {object} subscription
 * @returns {object} Access state details
 */
export function getSubscriptionAccessDetails(subscription) {
  if (!subscription) {
    return {
      hasAccess: false,
      status: 'none',
      isTrialing: false,
      isScheduledForCancel: false,
      isScheduledForPause: false,
      scheduledChangeAt: null,
      message: 'No subscription found.'
    };
  }

  const status = (subscription.status || '').toLowerCase().trim();
  const hasAccess = hasSubscriptionAccess(subscription);
  const scheduledAction = (
    subscription.scheduled_change_action ||
    subscription.scheduled_change?.action ||
    subscription.scheduledChange?.action ||
    ''
  ).toLowerCase().trim();

  const scheduledChangeAt = (
    subscription.scheduled_change_at ||
    subscription.scheduled_change?.effective_at ||
    subscription.scheduledChange?.effectiveAt ||
    null
  );

  const isScheduledForCancel = scheduledAction === 'cancel';
  const isScheduledForPause = scheduledAction === 'pause';

  let message = 'Subscription inactive';
  if (status === 'active') {
    if (isScheduledForCancel) {
      message = `Active (Set to cancel on ${scheduledChangeAt ? new Date(scheduledChangeAt).toLocaleDateString() : 'end of billing period'})`;
    } else if (isScheduledForPause) {
      message = `Active (Set to pause on ${scheduledChangeAt ? new Date(scheduledChangeAt).toLocaleDateString() : 'end of billing period'})`;
    } else {
      message = 'Active paid subscription';
    }
  } else if (status === 'trialing') {
    message = 'Trial period active';
  } else if (status === 'past_due') {
    message = 'Payment past due. Please update payment method to restore access.';
  } else if (status === 'paused') {
    message = 'Subscription paused.';
  } else if (status === 'canceled') {
    message = 'Subscription canceled.';
  }

  return {
    hasAccess,
    status,
    isTrialing: status === 'trialing',
    isScheduledForCancel,
    isScheduledForPause,
    scheduledChangeAt,
    message,
    subscriptionId: subscription.subscription_id || subscription.id,
    customerId: subscription.customer_id || subscription.customerId,
    priceId: subscription.price_id || subscription.priceId,
    productId: subscription.product_id || subscription.productId
  };
}
