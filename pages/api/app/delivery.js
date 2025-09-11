// API para consultas de delivery desde el frontend
import { connectDB } from "../../../components/db-connect";
import { applyCORS } from "../../../middleware/middleware-cors";

export default async function handler(req, res) {
  const { method, query } = req;

  // Aplicar CORS
  applyCORS(req, res);

  try {
    await connectDB();

    switch (method) {
      case 'OPTIONS':
        // Manejar preflight CORS request
        return res.status(200).end();
      case 'GET':
        return await handleGet(req, res);
      default:
        return res.status(405).json({ message: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API delivery:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
}

async function handleGet(req, res) {
  const { type, district, department } = req.query;

  try {
    switch (type) {
      case 'zone-by-district':
        return await getZoneByDistrict(req, res, district);
      case 'agencies-by-department':
        return await getAgenciesByDepartment(req, res, department);
      case 'all-zones':
        return await getAllZones(req, res);
      case 'all-agencies':
        return await getAllAgencies(req, res);
      default:
        return res.status(400).json({ message: 'Tipo de consulta no válido' });
    }
  } catch (error) {
    console.error('Error en handleGet:', error);
    return res.status(500).json({ message: 'Error procesando consulta' });
  }
}

// Obtener zona y precio por distrito (para Lima)
async function getZoneByDistrict(req, res, district) {
  if (!district) {
    return res.status(400).json({ message: 'Distrito requerido' });
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Buscar distrito con su zona
    const districtInfo = await db.collection('delivery_districts')
      .findOne({ 
        district_name: { $regex: new RegExp(district, 'i') },
        active: true 
      });

    if (!districtInfo) {
      await client.close();
      return res.status(404).json({ 
        message: 'Distrito no encontrado o sin cobertura de delivery',
        available: false
      });
    }

    // Buscar información de la zona
    const zoneInfo = await db.collection('delivery_zones')
      .findOne({ 
        _id: districtInfo.zone_id,
        active: true 
      });

    await client.close();

    if (!zoneInfo) {
      return res.status(404).json({ 
        message: 'Zona no encontrada',
        available: false
      });
    }

    return res.status(200).json({
      available: true,
      district: districtInfo.district_name,
      zone: {
        _id: zoneInfo._id,
        zone_name: zoneInfo.zone_name,
        zone_id: zoneInfo.zone_id,
        price: zoneInfo.price,
        description: zoneInfo.description
      }
    });

  } catch (error) {
    console.error('Error obteniendo zona por distrito:', error);
    return res.status(500).json({ message: 'Error consultando zona' });
  }
}

// Obtener agencias disponibles por departamento (para provincias)
async function getAgenciesByDepartment(req, res, department) {
  if (!department) {
    return res.status(400).json({ message: 'Departamento requerido' });
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Buscar agencias que cubran el departamento o sean nacionales
    const agencies = await db.collection('delivery_agencies')
      .find({ 
        $and: [
          { active: true },
          {
            $or: [
              { coverage_areas: { $in: [department.toLowerCase()] } },
              { coverage_areas: { $in: ['nacional'] } }
            ]
          }
        ]
      })
      .sort({ agency_name: 1 })
      .toArray();

    await client.close();

    return res.status(200).json({
      available: agencies.length > 0,
      department: department,
      agencies: agencies.map(agency => ({
        _id: agency._id,
        agency_name: agency.agency_name,
        agency_id: agency.agency_id || agency._id,
        coverage_areas: agency.coverage_areas
      }))
    });

  } catch (error) {
    console.error('Error obteniendo agencias por departamento:', error);
    return res.status(500).json({ message: 'Error consultando agencias' });
  }
}

// Obtener todas las zonas (para admin o referencia)
async function getAllZones(req, res) {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const zones = await db.collection('delivery_zones')
      .find({ active: true })
      .sort({ zone_number: 1 })
      .toArray();

    await client.close();

    return res.status(200).json({
      zones: zones
    });

  } catch (error) {
    console.error('Error obteniendo todas las zonas:', error);
    return res.status(500).json({ message: 'Error consultando zonas' });
  }
}

// Obtener todas las agencias activas
async function getAllAgencies(req, res) {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const agencies = await db.collection('delivery_agencies')
      .find({ active: true })
      .sort({ agency_name: 1 })
      .toArray();

    await client.close();

    return res.status(200).json({
      agencies: agencies.map(agency => ({
        agency_name: agency.agency_name,
        agency_code: agency.agency_code,
        coverage_areas: agency.coverage_areas
      }))
    });

  } catch (error) {
    console.error('Error obteniendo todas las agencias:', error);
    return res.status(500).json({ message: 'Error consultando agencias' });
  }
} 