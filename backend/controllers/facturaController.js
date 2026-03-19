const { timbrarFactura } = require("../services/facturamaService");

exports.facturar = async (req, res) => {
  try {

    const factura = {
      CfdiType: "I",
      ExpeditionPlace: "64000",
      PaymentForm: "01",
      PaymentMethod: "PUE",
      Receiver: {
        Rfc: req.body.rfc,
        Name: req.body.nombre,
        CfdiUse: "G03",
        Email: req.body.email,
        FiscalRegime: "616",
        TaxZipCode: "64000"
      },
      Items: req.body.items
    };

    const resultado = await timbrarFactura(factura);

    res.status(200).json({
      success: true,
      uuid: resultado.Uuid,
      facturamaId: resultado.Id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error
    });
  }
};