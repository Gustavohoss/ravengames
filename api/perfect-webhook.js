// ========================================================
// PERFECT PAY WEBHOOK HANDLER — RAVEN GAMES
// Recebe notificações de vendas, PIX gerados e status da Perfect Pay
// e salva em tempo real no Firestore sem pesar na Vercel
// ========================================================

module.exports = async (req, res) => {
  // Configuração de CORS para permitir requisições de teste e do gateway
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Se abrir no navegador via GET, exibe status online do webhook
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'Raven Games Perfect Pay Webhook Endpoint',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    let payload = req.body;

    // Caso o corpo venha como string / buffer
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        const params = new URLSearchParams(payload);
        payload = Object.fromEntries(params);
      }
    } else if (Buffer.isBuffer(payload)) {
      try {
        payload = JSON.parse(payload.toString('utf8'));
      } catch (e) {
        const params = new URLSearchParams(payload.toString('utf8'));
        payload = Object.fromEntries(params);
      }
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    // Extrair dados do pedido / cliente da Perfect Pay
    const codigoVenda = payload.code || payload.sale_code || payload.order_id || ('PP_' + Date.now());
    const statusEnum = parseInt(payload.sale_status_enum || payload.status_enum || '1', 10);
    const statusTexto = payload.sale_status || payload.status || (statusEnum === 2 ? 'Aprovado' : 'Aguardando pagamento');
    const metodoPagamento = (payload.payment_type || payload.payment_method || 'pix').toLowerCase();

    // Cliente
    const customer = payload.customer || {};
    const nome = customer.full_name || customer.name || payload.customer_name || 'Cliente';
    const email = (customer.email || payload.customer_email || '').trim().toLowerCase();

    // Telefone / WhatsApp
    let rawPhone = customer.phone_formated || customer.phone || payload.customer_phone || '';
    if (!rawPhone && (customer.phone_number || payload.phone_number)) {
      const ddd = customer.phone_area_code || payload.phone_area_code || '11';
      const num = customer.phone_number || payload.phone_number;
      rawPhone = `${ddd}${num}`;
    }

    // Limpar apenas números
    const telNumeros = (rawPhone || '').replace(/\D/g, '');
    let telWhatsapp = telNumeros;
    // Se não tiver código do país 55 e tiver 10 ou 11 dígitos, adiciona 55
    if (telNumeros.length === 10 || telNumeros.length === 11) {
      telWhatsapp = '55' + telNumeros;
    }

    // Produto & Valores
    const produto = payload.product || {};
    const nomeProduto = produto.name || payload.product_name || 'Raven Games';
    const valor = parseFloat(payload.sale_amount || payload.amount || payload.value || '0') || 0;

    // PIX dados (se existirem)
    const pixData = payload.pix || {};
    const pixCopiaCola = pixData.pix_code || pixData.qrcode || payload.pix_code || '';
    const pixUrl = pixData.pix_url || payload.pix_url || '';

    // Classificação simplificada de status
    // 1 = Aguardando pagamento | 2 = Aprovado | 3 = Cancelado | 4 = Reclamado | 5 = Devolvido
    let statusGeral = 'PENDENTE_PIX';
    if (statusEnum === 2 || statusTexto.toLowerCase().includes('aprovad')) {
      statusGeral = 'APROVADO';
    } else if (statusEnum === 3 || statusTexto.toLowerCase().includes('cancelad')) {
      statusGeral = 'CANCELADO';
    } else if (statusEnum === 5 || statusTexto.toLowerCase().includes('devolvid') || statusTexto.toLowerCase().includes('reembols')) {
      statusGeral = 'REEMBOLSADO';
    }

    // Montar documento Firestore
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/tiklive-6ff37/databases/(default)/documents/leads_pedidos/${encodeURIComponent(codigoVenda)}`;

    const fields = {
      codigo: { stringValue: String(codigoVenda) },
      status: { stringValue: statusTexto },
      statusGeral: { stringValue: statusGeral },
      statusEnum: { integerValue: String(statusEnum) },
      metodo: { stringValue: metodoPagamento },
      nome: { stringValue: String(nome) },
      email: { stringValue: String(email) },
      telefone: { stringValue: String(telNumeros) },
      whatsapp: { stringValue: String(telWhatsapp) },
      telefoneFormatado: { stringValue: String(rawPhone || telNumeros) },
      produto: { stringValue: String(nomeProduto) },
      valor: { doubleValue: valor },
      pixCopiaCola: { stringValue: String(pixCopiaCola) },
      pixUrl: { stringValue: String(pixUrl) },
      contatado: { booleanValue: false },
      criadoEm: { stringValue: payload.date_created || new Date().toISOString() },
      atualizadoEm: { stringValue: new Date().toISOString() }
    };

    const updateMask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');

    const fsResponse = await fetch(`${firestoreUrl}?${updateMask}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    if (!fsResponse.ok) {
      const errText = await fsResponse.text();
      console.error('Erro ao salvar no Firestore:', errText);
      return res.status(500).json({ error: 'Erro ao gravar no banco', details: errText });
    }

    return res.status(200).json({
      success: true,
      message: `Lead/Venda ${codigoVenda} registrada com sucesso como ${statusGeral}`,
      codigo: codigoVenda,
      status: statusGeral
    });

  } catch (error) {
    console.error('Erro geral no webhook:', error);
    return res.status(500).json({ error: 'Falha interna no processamento', message: error.message });
  }
};
