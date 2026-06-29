const SzinnAPI = {
  async getOrders() {
    const res = await fetch('/api/orders', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Kon aanvragen niet ophalen');
    return res.json();
  },

  async getOrder(orderId) {
    const res = await fetch(`/api/orders/${orderId}`, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return res.json();
  },

  async submitQuestionnaire(orderId, answers) {
    const res = await fetch(`/api/orders/${orderId}/questionnaire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(answers)
    });
    if (!res.ok) throw new Error('Verzenden mislukt');
    return res.json();
  }
};
