// API para gestión de delivery desde el admin
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
      case 'POST':
        return await handlePost(req, res);
      case 'PUT':
        return await handlePut(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ message: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API delivery management:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
}

async function handleGet(req, res) {
  const { type } = req.query;

  try {
    switch (type) {
      case 'zones':
        return await getAllZones(req, res);
      case 'districts':
        return await getAllDistricts(req, res);
      case 'agencies':
        return await getAllAgencies(req, res);
      case 'overview':
        return await getDeliveryOverview(req, res);
      case 'departments':
        return await getDepartmentsAdmin(req, res);
      case 'provinces':
        return await getProvincesByDepartmentAdmin(req, res);
      case 'districts-admin':
        return await getDistrictsByProvinceAdmin(req, res);
      default:
        return res.status(400).json({ message: 'Tipo de consulta no válido' });
    }
  } catch (error) {
    console.error('Error en handleGet:', error);
    return res.status(500).json({ message: 'Error procesando consulta' });
  }
}

async function handlePost(req, res) {
  const { type } = req.query;
  const data = req.body;

  try {
    switch (type) {
      case 'zone':
        return await createZone(req, res, data);
      case 'district':
        return await createDistrict(req, res, data);
      case 'agency':
        return await createAgency(req, res, data);
      default:
        return res.status(400).json({ message: 'Tipo de creación no válido' });
    }
  } catch (error) {
    console.error('Error en handlePost:', error);
    return res.status(500).json({ message: 'Error creando elemento' });
  }
}

async function handlePut(req, res) {
  const { type, id } = req.query;
  const data = req.body;

  try {
    switch (type) {
      case 'zone':
        return await updateZone(req, res, id, data);
      case 'district':
        return await updateDistrict(req, res, id, data);
      case 'agency':
        return await updateAgency(req, res, id, data);
      default:
        return res.status(400).json({ message: 'Tipo de actualización no válido' });
    }
  } catch (error) {
    console.error('Error en handlePut:', error);
    return res.status(500).json({ message: 'Error actualizando elemento' });
  }
}

async function handleDelete(req, res) {
  const { type, id } = req.query;

  try {
    switch (type) {
      case 'zone':
        return await deleteZone(req, res, id);
      case 'district':
        return await deleteDistrict(req, res, id);
      case 'agency':
        return await deleteAgency(req, res, id);
      default:
        return res.status(400).json({ message: 'Tipo de eliminación no válido' });
    }
  } catch (error) {
    console.error('Error en handleDelete:', error);
    return res.status(500).json({ message: 'Error eliminando elemento' });
  }
}

// =================== ZONAS ===================

async function getAllZones(req, res) {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Obtener zonas con conteo de distritos
    const zones = await db.collection('delivery_zones').aggregate([
      {
        $lookup: {
          from: 'delivery_districts',
          localField: '_id',
          foreignField: 'zone_id',
          as: 'districts'
        }
      },
      {
        $addFields: {
          district_count: { $size: '$districts' }
        }
      },
      {
        $sort: { zone_number: 1 }
      }
    ]).toArray();

    await client.close();

    return res.status(200).json({
      success: true,
      zones: zones
    });

  } catch (error) {
    console.error('Error obteniendo zonas:', error);
    return res.status(500).json({ message: 'Error consultando zonas' });
  }
}

async function createZone(req, res, data) {
  const { zone_name, zone_id, price, description } = data;

  if (!zone_name || !zone_id || !price) {
    return res.status(400).json({ 
      message: 'Nombre de zona, ID y precio son requeridos' 
    });
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Verificar que no exista una zona con el mismo ID
    const existingZone = await db.collection('delivery_zones')
      .findOne({ zone_id: zone_id });

    if (existingZone) {
      await client.close();
      return res.status(400).json({ 
        message: `Ya existe una zona con el ID ${zone_id}` 
      });
    }

    const newZone = {
      zone_name,
      zone_id,
      price: parseFloat(price),
      delivery_type: 'local',
      description: description || '',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('delivery_zones').insertOne(newZone);
    
    await client.close();

    return res.status(201).json({
      success: true,
      message: 'Zona creada exitosamente',
      zone: { ...newZone, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error creando zona:', error);
    return res.status(500).json({ message: 'Error creando zona' });
  }
}

async function updateZone(req, res, id, data) {
  const { zone_name, price, description, active } = data;

  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const updateData = {
      updated_at: new Date()
    };

    if (zone_name) updateData.zone_name = zone_name;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (description !== undefined) updateData.description = description;
    if (active !== undefined) updateData.active = active;

    const result = await db.collection('delivery_zones')
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Zona no encontrada' });
    }

    return res.status(200).json({
      success: true,
      message: 'Zona actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando zona:', error);
    return res.status(500).json({ message: 'Error actualizando zona' });
  }
}

async function deleteZone(req, res, id) {
  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Verificar si hay distritos asignados a esta zona
    const districtsCount = await db.collection('delivery_districts')
      .countDocuments({ zone_id: new ObjectId(id) });

    if (districtsCount > 0) {
      await client.close();
      return res.status(400).json({ 
        message: `No se puede eliminar la zona. Tiene ${districtsCount} distrito(s) asignado(s)` 
      });
    }

    const result = await db.collection('delivery_zones')
      .deleteOne({ _id: new ObjectId(id) });

    await client.close();

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Zona no encontrada' });
    }

    return res.status(200).json({
      success: true,
      message: 'Zona eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando zona:', error);
    return res.status(500).json({ message: 'Error eliminando zona' });
  }
}

// =================== DISTRITOS ===================

async function getAllDistricts(req, res) {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Obtener distritos con información de zona
    const districts = await db.collection('delivery_districts').aggregate([
      {
        $lookup: {
          from: 'delivery_zones',
          localField: 'zone_id',
          foreignField: '_id',
          as: 'zone_info'
        }
      },
      {
        $addFields: {
          zone_info: { $arrayElemAt: ['$zone_info', 0] }
        }
      },
      {
        $sort: { district_name: 1 }
      }
    ]).toArray();

    await client.close();

    return res.status(200).json({
      success: true,
      districts: districts
    });

  } catch (error) {
    console.error('Error obteniendo distritos:', error);
    return res.status(500).json({ message: 'Error consultando distritos' });
  }
}

async function createDistrict(req, res, data) {
  const { district_name, department, province, zone_id } = data;

  if (!district_name || !department || !province || !zone_id) {
    return res.status(400).json({ 
      message: 'Nombre del distrito, departamento, provincia y zona son requeridos' 
    });
  }

  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Verificar que la zona existe
    const zone = await db.collection('delivery_zones')
      .findOne({ _id: new ObjectId(zone_id) });

    if (!zone) {
      await client.close();
      return res.status(400).json({ message: 'Zona no encontrada' });
    }

    // Verificar que no exista un distrito con el mismo nombre
    const existingDistrict = await db.collection('delivery_districts')
      .findOne({ 
        district_name: { $regex: new RegExp(`^${district_name}$`, 'i') },
        department: department.toLowerCase(),
        province: province.toLowerCase()
      });

    if (existingDistrict) {
      await client.close();
      return res.status(400).json({ 
        message: `Ya existe el distrito ${district_name} en ${province}, ${department}` 
      });
    }

    const newDistrict = {
      district_name,
      department: department.toLowerCase(),
      province: province.toLowerCase(),
      zone_id: new ObjectId(zone_id),
      zone_number: zone.zone_number,
      delivery_type: 'local',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('delivery_districts').insertOne(newDistrict);
    
    await client.close();

    return res.status(201).json({
      success: true,
      message: 'Distrito creado exitosamente',
      district: { ...newDistrict, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error creando distrito:', error);
    return res.status(500).json({ message: 'Error creando distrito' });
  }
}

async function updateDistrict(req, res, id, data) {
  const { district_name, zone_id, active } = data;

  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const updateData = {
      updated_at: new Date()
    };

    if (district_name) updateData.district_name = district_name;
    if (active !== undefined) updateData.active = active;
    
    if (zone_id) {
      // Verificar que la nueva zona existe y obtener su número
      const zone = await db.collection('delivery_zones')
        .findOne({ _id: new ObjectId(zone_id) });

      if (!zone) {
        await client.close();
        return res.status(400).json({ message: 'Zona no encontrada' });
      }

      updateData.zone_id = new ObjectId(zone_id);
      updateData.zone_number = zone.zone_number;
    }

    const result = await db.collection('delivery_districts')
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Distrito no encontrado' });
    }

    return res.status(200).json({
      success: true,
      message: 'Distrito actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando distrito:', error);
    return res.status(500).json({ message: 'Error actualizando distrito' });
  }
}

async function deleteDistrict(req, res, id) {
  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const result = await db.collection('delivery_districts')
      .deleteOne({ _id: new ObjectId(id) });

    await client.close();

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Distrito no encontrado' });
    }

    return res.status(200).json({
      success: true,
      message: 'Distrito eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando distrito:', error);
    return res.status(500).json({ message: 'Error eliminando distrito' });
  }
}

// =================== AGENCIAS ===================

async function getAllAgencies(req, res) {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const agencies = await db.collection('delivery_agencies')
      .find({})
      .sort({ agency_name: 1 })
      .toArray();

    await client.close();

    return res.status(200).json({
      success: true,
      agencies: agencies
    });

  } catch (error) {
    console.error('Error obteniendo agencias:', error);
    return res.status(500).json({ message: 'Error consultando agencias' });
  }
}

async function createAgency(req, res, data) {
  const { agency_name, agency_id, coverage_areas } = data;

  if (!agency_name || !agency_id) {
    return res.status(400).json({ 
      message: 'Nombre de agencia y ID son requeridos' 
    });
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Verificar que no exista una agencia con el mismo ID
    const existingAgency = await db.collection('delivery_agencies')
      .findOne({ agency_id: agency_id });

    if (existingAgency) {
      await client.close();
      return res.status(400).json({ 
        message: `Ya existe una agencia con el ID ${agency_id}` 
      });
    }

    const newAgency = {
      agency_name,
      agency_id,
      coverage_areas: coverage_areas || ['nacional'],
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('delivery_agencies').insertOne(newAgency);
    
    await client.close();

    return res.status(201).json({
      success: true,
      message: 'Agencia creada exitosamente',
      agency: { ...newAgency, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error creando agencia:', error);
    return res.status(500).json({ message: 'Error creando agencia' });
  }
}

async function updateAgency(req, res, id, data) {
  const { agency_name, coverage_areas, active } = data;

  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const updateData = {
      updated_at: new Date()
    };

    if (agency_name) {
      updateData.agency_name = agency_name;
      updateData.agency_code = agency_name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
    if (coverage_areas) updateData.coverage_areas = coverage_areas;
    if (active !== undefined) updateData.active = active;

    const result = await db.collection('delivery_agencies')
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    await client.close();

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Agencia no encontrada' });
    }

    return res.status(200).json({
      success: true,
      message: 'Agencia actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando agencia:', error);
    return res.status(500).json({ message: 'Error actualizando agencia' });
  }
}

async function deleteAgency(req, res, id) {
  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    const result = await db.collection('delivery_agencies')
      .deleteOne({ _id: new ObjectId(id) });

    await client.close();

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Agencia no encontrada' });
    }

    return res.status(200).json({
      success: true,
      message: 'Agencia eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando agencia:', error);
    return res.status(500).json({ message: 'Error eliminando agencia' });
  }
}

// =================== OVERVIEW ===================

async function getDeliveryOverview(req, res) {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    
    // Estadísticas generales
    const totalZones = await db.collection('delivery_zones').countDocuments({ active: true });
    const totalDistricts = await db.collection('delivery_districts').countDocuments({ active: true });
    const totalAgencies = await db.collection('delivery_agencies').countDocuments({ active: true });
    
    // Distribución de distritos por zona
    const districtsByZone = await db.collection('delivery_districts').aggregate([
      { $match: { active: true } },
      {
        $lookup: {
          from: 'delivery_zones',
          localField: 'zone_id',
          foreignField: '_id',
          as: 'zone_info'
        }
      },
      {
        $group: {
          _id: '$zone_number',
          zone_name: { $first: { $arrayElemAt: ['$zone_info.zone_name', 0] } },
          district_count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    await client.close();

    return res.status(200).json({
      success: true,
      overview: {
        total_zones: totalZones,
        total_districts: totalDistricts,
        total_agencies: totalAgencies,
        districts_by_zone: districtsByZone
      }
    });

  } catch (error) {
    console.error('Error obteniendo overview:', error);
    return res.status(500).json({ message: 'Error consultando resumen' });
  }
} 

// Obtener todos los departamentos únicos para admin
async function getDepartmentsAdmin(req, res) {
  try {
    const db = await connectDB();
    
    const departments = await db.collection('delivery_districts')
      .distinct('department', { 
        active: true,
        department: { $ne: null, $ne: "", $not: /^(test|dasdas|asdasd|xxx)/i }
      });

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
    console.error('Error obteniendo departamentos admin:', error);
    return res.status(500).json({ message: 'Error consultando departamentos' });
  }
}

// Obtener provincias por departamento para admin
async function getProvincesByDepartmentAdmin(req, res) {
  const { department } = req.query;
  
  if (!department) {
    return res.status(400).json({ message: 'Departamento requerido' });
  }

  try {
    const db = await connectDB();
    
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
    console.error('Error obteniendo provincias admin:', error);
    return res.status(500).json({ message: 'Error consultando provincias' });
  }
} 

// Obtener distritos por departamento y provincia para admin
async function getDistrictsByProvinceAdmin(req, res) {
  const { department, province } = req.query;
  
  if (!department || !province) {
    return res.status(400).json({ message: 'Departamento y provincia requeridos' });
  }

  try {
    const db = await connectDB();
    
    let districts = [];
    
    // Si es Callao, usar distritos específicos
    if (department.toLowerCase() === 'callao' && province.toLowerCase() === 'callao') {
      districts = [
        'Bellavista',
        'Callao',
        'Carmen de la Legua Reynoso',
        'La Perla',
        'La Punta',
        'Ventanilla'
      ];
    } else {
      // Para otros departamentos, cargar desde la base de datos
      districts = await db.collection('delivery_districts')
        .distinct('district_name', { 
          department: department.toLowerCase(),
          province: province.toLowerCase(),
          active: true,
          district_name: { $ne: null, $ne: "" }
        });
    }

    // Filtrar distritos válidos
    const validDistricts = districts
      .filter(dist => dist && dist.length > 2 && !dist.includes('test') && !dist.includes('das'))
      .map(dist => ({
        value: dist,
        name: dist
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      districts: validDistricts
    });

  } catch (error) {
    console.error('Error obteniendo distritos admin:', error);
    return res.status(500).json({ message: 'Error consultando distritos' });
  }
} 