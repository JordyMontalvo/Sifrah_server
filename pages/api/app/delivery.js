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
      case 'departments':
        return await getDepartments(req, res);
      case 'provinces':
        return await getProvincesByDepartment(req, res, department);
      case 'districts':
        return await getDistrictsByProvince(req, res, department, req.query.province);
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
    
    // Buscar todas las agencias activas (sin filtro de cobertura)
    const agencies = await db.collection('delivery_agencies')
      .find({ active: true })
      .sort({ agency_name: 1 })
      .toArray();

    await client.close();

    if (agencies.length === 0) {
      console.error('No se encontraron agencias activas');
    }

    return res.status(200).json({
      available: agencies.length > 0,
      department: department,
      agencies: agencies.map(agency => ({
        _id: agency._id,
        agency_name: agency.agency_name,
        agency_id: agency.agency_id || agency._id,
        agency_code: agency.agency_code, // Añadir agency_code
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

// Obtener todos los departamentos únicos de la colección de distritos
async function getDepartments(req, res) {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const departments = await db.collection('delivery_districts')
      .distinct('department', { 
        active: true,
        department: { $ne: null, $ne: "" },
        // Filtrar datos de prueba/basura
        department: { $not: /^(test|dasdas|asdasd|xxx)/i }
      });

    await client.close();

    // Filtrar y limpiar departamentos válidos
    let validDepartments = departments
      .filter(dept => dept && dept.length > 2 && !dept.includes('test') && !dept.includes('das'))
      .map(dept => ({
        value: dept.toLowerCase(),
        name: dept.charAt(0).toUpperCase() + dept.slice(1)
      }));

    // Agregar Callao como departamento si no existe
    const callaoExists = validDepartments.some(dept => dept.value === 'callao' || dept.name.toLowerCase() === 'callao');
    if (!callaoExists) {
      validDepartments.push({
        value: 'callao',
        name: 'Callao'
      });
    }

    // Ordenar alfabéticamente
    validDepartments.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      departments: validDepartments
    });

  } catch (error) {
    console.error('Error obteniendo departamentos:', error);
    return res.status(500).json({ message: 'Error consultando departamentos' });
  }
}

// Obtener provincias por departamento
async function getProvincesByDepartment(req, res, department) {
  if (!department) {
    return res.status(400).json({ message: 'Departamento requerido' });
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    let provinces = [];
    
    // Si es Callao, usar provincias específicas
    if (department.toLowerCase() === 'callao') {
      provinces = ['Callao'];
    } else {
      // Para otros departamentos, cargar desde la base de datos
      provinces = await db.collection('delivery_districts')
        .distinct('province', { 
          department: department.toLowerCase(),
          active: true,
          province: { $ne: null, $ne: "" }
        });
    }

    await client.close();

    // Filtrar provincias válidas
    let validProvinces = provinces
      .filter(prov => prov && prov.length > 2 && !prov.includes('test') && !prov.includes('das'))
      .map(prov => ({
        value: prov.toLowerCase(),
        name: prov.charAt(0).toUpperCase() + prov.slice(1)
      }));

    // Ordenar alfabéticamente
    validProvinces.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      provinces: validProvinces
    });

  } catch (error) {
    console.error('Error obteniendo provincias:', error);
    return res.status(500).json({ message: 'Error consultando provincias' });
  }
}

// Obtener distritos por departamento y provincia
async function getDistrictsByProvince(req, res, department, province) {
  if (!department || !province) {
    return res.status(400).json({ message: 'Departamento y provincia requeridos' });
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    let districts = [];
    
    // Si es Callao, usar distritos específicos
    if (department.toLowerCase() === 'callao' && province.toLowerCase() === 'callao') {
      districts = [
        { district_name: 'Bellavista', zone_id: null, delivery_type: 'zone' },
        { district_name: 'Callao', zone_id: null, delivery_type: 'zone' },
        { district_name: 'Carmen de la Legua Reynoso', zone_id: null, delivery_type: 'zone' },
        { district_name: 'La Perla', zone_id: null, delivery_type: 'zone' },
        { district_name: 'La Punta', zone_id: null, delivery_type: 'zone' },
        { district_name: 'Ventanilla', zone_id: null, delivery_type: 'zone' }
      ];
    } else {
      // Para otros departamentos, cargar desde la base de datos
      districts = await db.collection('delivery_districts')
        .find({ 
          department: department.toLowerCase(),
          province: province.toLowerCase(),
          active: true,
          district_name: { $ne: null, $ne: "" },
          // Filtrar datos de prueba
          district_name: { $not: /^(test|dasdas|asdasd|xxx)/i }
        })
        .sort({ district_name: 1 })
        .toArray();
    }

    await client.close();

    // Filtrar distritos válidos
    const validDistricts = districts
      .filter(district => district.district_name && 
                         district.district_name.length > 2 && 
                         !district.district_name.includes('test') && 
                         !district.district_name.includes('das'))
      .map(district => ({
        value: district.district_name,
        name: district.district_name,
        zone_id: district.zone_id,
        delivery_type: district.delivery_type
      }));

    return res.status(200).json({
      districts: validDistricts
    });

  } catch (error) {
    console.error('Error obteniendo distritos:', error);
    return res.status(500).json({ message: 'Error consultando distritos' });
  }
} 