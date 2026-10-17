// ========================================================
// RAVENGAMES TRAFFIC TRACKER (Zero Vercel Bandwidth)
// Envia dados de origem diretamente ao Google Firestore
// Totalmente assíncrono e invisível para o usuário
// ========================================================

(function() {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const sessionKey = 'rg_tr_' + hoje;

    // Se já rastreou nesta sessão hoje, não duplica gravação
    if (sessionStorage.getItem(sessionKey)) return;

    const urlParams = new URLSearchParams(window.location.search);
    const rawRef = document.referrer ? document.referrer.toLowerCase() : '';
    
    let origem = 'Direto / Bio';
    let subOrigem = '';

    const utmSource = (urlParams.get('utm_source') || '').trim();
    const utmMedium = (urlParams.get('utm_medium') || '').trim();
    const utmCampaign = (urlParams.get('utm_campaign') || '').trim();
    const utmContent = (urlParams.get('utm_content') || '').trim();

    if (utmSource) {
      origem = utmSource.toUpperCase();
      subOrigem = utmMedium ? `${utmMedium} / ${utmCampaign}` : utmCampaign;
    } else if (rawRef) {
      if (rawRef.includes('tiktok') || rawRef.includes('bytedance') || rawRef.includes('musical.ly')) {
        origem = 'TikTok';
      } else if (rawRef.includes('instagram')) {
        origem = 'Instagram';
      } else if (rawRef.includes('youtube') || rawRef.includes('youtu.be')) {
        origem = 'YouTube';
      } else if (rawRef.includes('facebook') || rawRef.includes('fb.') || rawRef.includes('fbclid')) {
        origem = 'Facebook';
      } else if (rawRef.includes('google')) {
        origem = 'Google Orgânico';
      } else if (rawRef.includes('kwai')) {
        origem = 'Kwai';
      } else if (rawRef.includes('twitter') || rawRef.includes('t.co') || rawRef.includes('x.com')) {
        origem = 'X (Twitter)';
      } else if (rawRef.includes('discord')) {
        origem = 'Discord';
      } else {
        try {
          const parsed = new URL(document.referrer);
          origem = parsed.hostname.replace('www.', '');
        } catch(e) {
          origem = 'Outros Sites';
        }
      }
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const docId = 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/tiklive-6ff37/databases/(default)/documents/visitas_site/${docId}`;

    const fields = {
      origem: { stringValue: String(origem) },
      subOrigem: { stringValue: String(subOrigem) },
      referrer: { stringValue: String(document.referrer || 'direto') },
      utmSource: { stringValue: String(utmSource) },
      utmMedium: { stringValue: String(utmMedium) },
      utmCampaign: { stringValue: String(utmCampaign) },
      utmContent: { stringValue: String(utmContent) },
      dispositivo: { stringValue: isMobile ? 'Mobile' : 'Desktop' },
      pagina: { stringValue: String(window.location.pathname || '/') },
      dataHora: { stringValue: new Date().toISOString() },
      dia: { stringValue: hoje }
    };

    fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      keepalive: true
    }).then(function(res) {
      if (res.ok) {
        sessionStorage.setItem(sessionKey, '1');
      }
    }).catch(function() {});
  } catch(e) {}
})();
