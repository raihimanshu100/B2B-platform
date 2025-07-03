// frontend/public/js/client.js
document.addEventListener('DOMContentLoaded', () => {
  const tenderContainer = document.getElementById('tenders');

  async function loadTenders() {
    try {
      const res = await axios.get('/tender');
      tenderContainer.innerHTML = `<pre>${JSON.stringify(res.data, null, 2)}</pre>`;
    } catch (err) {
      console.error('Error loading tenders', err);
    }
  }

  if (tenderContainer) {
    loadTenders();
  }
});
