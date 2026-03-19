// Script para consultar lugares de expedición en Facturama
// Ejecutar con: node verificar-lugares-expedicion.js

const axios = require('axios');
require('dotenv').config();

const baseURL = process.env.FACTURAMA_BASE_URL;
const auth = Buffer.from(`${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASSWORD}`).toString('base64');

async function consultarLugaresExpedicion() {
  try {
    const response = await axios.get(
      `${baseURL}/Catalogs/BranchOffices`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    console.log('Lugares de expedición registrados en Facturama:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('\nCódigos postales disponibles:');
      response.data.forEach(lugar => {
        console.log(`- ${lugar.Address?.ZipCode || 'N/A'} (${lugar.Name || 'Sin nombre'})`);
      });
    } else {
      console.log('\nNo hay lugares de expedición registrados.');
      console.log('Debes agregar al menos uno en: https://apisandbox.facturama.mx/');
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

consultarLugaresExpedicion();
