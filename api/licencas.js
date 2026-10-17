// ========================================================
// RAVEN GAMES MOBILE — VALIDADOR DE LICENÇAS
// Endpoint oficial para liberar o app móvel da Raven Games
// ========================================================

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Resposta sempre aprovada para o Raven Games Mobile
  return res.status(200).json({
    status: "active",
    plan: "completo",
    expiresAt: "2099-12-31T23:59:59.000Z",
    diasRestantes: 9999,
    message: "Licença Raven Games Mobile ativa."
  });
};
