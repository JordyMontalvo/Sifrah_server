import { connectDB } from './db-connect';

class MLMPredictionService {
  constructor() {
    this.db = null;
  }

  async connect() {
    if (!this.db) {
      this.db = await connectDB();
    }
    return this.db;
  }

  // Extraer features de un usuario para predicción
  async extractUserFeatures(userId) {
    const db = await this.connect();
    
    try {
      // Obtener datos del usuario
      const user = await db.collection('users').findOne({ _id: userId });
      if (!user) return null;

      // Obtener afiliaciones del usuario
      const affiliations = await db.collection('affiliations')
        .find({ userId: user.id })
        .toArray();

      // Obtener activaciones del usuario
      const activations = await db.collection('activations')
        .find({ userId: user.id })
        .toArray();

      // Obtener transacciones del usuario
      const transactions = await db.collection('transactions')
        .find({ user_id: userId })
        .toArray();

      // Obtener estructura del árbol
      const treeData = await db.collection('tree')
        .findOne({ id: user.id });

      // Obtener recolecciones del usuario
      const collects = await db.collection('collects')
        .find({ userId: user.id })
        .toArray();

      // Obtener información de productos y planes
      const plans = await db.collection('plans').find().toArray();
      const products = await db.collection('products').find().toArray();

      // Calcular features
      const features = this.calculateFeatures(user, affiliations, activations, transactions, treeData, collects, plans, products);
      
      return features;
    } catch (error) {
      console.error('Error extrayendo features del usuario:', error);
      return null;
    }
  }

  // Calcular features para el modelo ML
  calculateFeatures(user, affiliations, activations, transactions, treeData, collects, plans, products) {
    const now = new Date();
    const affiliationDate = user.affiliation_date ? new Date(user.affiliation_date) : now;
    const daysSinceAffiliation = Math.floor((now - affiliationDate) / (1000 * 60 * 60 * 24));

    // Features básicos del usuario
    const planLevel = this.getPlanLevel(user.plan || 'basic');
    const points = user.points || 0;
    const affiliationPoints = user.affiliation_points || 0;
    const totalPoints = user.total_points || 0;
    const country = user.country || 'unknown';
    const city = user.city || 'unknown';

    // Features de red - ANÁLISIS COMPLETO DEL ÁRBOL
    const networkAnalysis = this.analyzeNetwork(user.id, treeData, activations, affiliations);
    
    // Features de actividad por mes
    const monthlyActivity = this.analyzeMonthlyActivity(activations, affiliations, transactions, 6);
    
    // Features de afiliaciones y referidos
    const referralAnalysis = this.analyzeReferrals(user.id, affiliations, activations);
    
    // Features de engagement y retención
    const engagementAnalysis = this.analyzeEngagement(user, activations, affiliations, transactions, daysSinceAffiliation);

    return {
      // Identificación
      user_id: user._id,
      name: user.name || user.username,
      email: user.email,
      dni: user.dni,
      
      // Features básicos
      plan_level: planLevel,
      plan_name: user.plan,
      days_since_affiliation: daysSinceAffiliation,
      points: points,
      affiliation_points: affiliationPoints,
      total_points: totalPoints,
      country: country,
      city: city,
      affiliated: user.affiliated || false,
      activated: user.activated || false,
      
      // Features de red COMPLETOS
      network_level: networkAnalysis.level,
      children_count: networkAnalysis.directChildren,
      network_size: networkAnalysis.totalNetworkSize,
      network_depth: networkAnalysis.maxDepth,
      network_coverage: networkAnalysis.coverage,
      network_efficiency: networkAnalysis.efficiency,
      network_growth_rate: networkAnalysis.growthRate,
      
      // Features de actividad por mes
      monthly_activations: monthlyActivity.activations,
      monthly_affiliations: monthlyActivity.affiliations,
      monthly_transactions: monthlyActivity.transactions,
      monthly_points: monthlyActivity.points,
      activity_trend: monthlyActivity.trend,
      
      // Features de afiliaciones y referidos
      total_affiliations: referralAnalysis.totalAffiliations,
      active_referrals: referralAnalysis.activeReferrals,
      inactive_referrals: referralAnalysis.inactiveReferrals,
      referral_conversion_rate: referralAnalysis.conversionRate,
      referral_quality_score: referralAnalysis.qualityScore,
      
      // Features de engagement
      total_activations: activations.length,
      total_transactions: transactions.length,
      total_collects: collects.length,
      engagement_score: engagementAnalysis.engagementScore,
      retention_score: engagementAnalysis.retentionScore,
      activity_frequency: engagementAnalysis.activityFrequency,
      
      // Features calculadas
      network_efficiency_score: networkAnalysis.efficiencyScore,
      business_activity_score: monthlyActivity.businessScore,
      referral_network_score: referralAnalysis.networkScore,
      
      // Timestamps
      affiliation_date: affiliationDate,
      last_activity: engagementAnalysis.lastActivity,
      created_at: new Date()
    };
  }

  // Análisis completo de la red del usuario
  analyzeNetwork(userId, treeData, activations, affiliations) {
    if (!treeData || !treeData.childs) {
      return {
        level: 1,
        directChildren: 0,
        totalNetworkSize: 0,
        maxDepth: 0,
        coverage: 0,
        efficiency: 0,
        growthRate: 0,
        efficiencyScore: 0
      };
    }

    const directChildren = treeData.childs.length;
    let totalNetworkSize = directChildren;
    let maxDepth = 1;
    let activeMembers = 0;
    let totalMembers = 0;

    // Calcular profundidad y tamaño total de la red
    const calculateNetworkDepth = (children, depth = 1) => {
      if (!children || children.length === 0) return depth;
      
      maxDepth = Math.max(maxDepth, depth);
      totalMembers += children.length;
      
      // Contar miembros activos (con activaciones recientes)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      children.forEach(childId => {
        const hasRecentActivity = activations.some(act => 
          act.userId === childId && new Date(act.date) > thirtyDaysAgo
        );
        if (hasRecentActivity) activeMembers++;
      });
      
      // Recursivamente calcular para hijos de hijos
      // (Aquí podrías implementar una búsqueda más profunda si es necesario)
    };

    calculateNetworkDepth(treeData.childs);
    
    // Calcular métricas de red
    const coverage = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
    const efficiency = directChildren > 0 ? totalNetworkSize / directChildren : 0;
    const growthRate = this.calculateGrowthRate(affiliations, 30); // últimos 30 días
    
    // Score de eficiencia de red (0-100)
    const efficiencyScore = Math.min(100, 
      (directChildren * 10) + 
      (maxDepth * 15) + 
      (coverage * 0.5) + 
      (growthRate * 20)
    );

    return {
      level: maxDepth,
      directChildren,
      totalNetworkSize: totalMembers,
      maxDepth,
      coverage: Math.round(coverage * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
      growthRate: Math.round(growthRate * 100) / 100,
      efficiencyScore: Math.round(efficiencyScore)
    };
  }

  // Análisis de actividad por mes
  analyzeMonthlyActivity(activations, affiliations, transactions, months = 6) {
    const monthlyData = {};
    const now = new Date();
    
    // Inicializar datos mensuales
    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
      monthlyData[monthKey] = {
        activations: 0,
        affiliations: 0,
        transactions: 0,
        points: 0,
        revenue: 0
      };
    }

    // Analizar activaciones por mes
    activations.forEach(activation => {
      const monthKey = new Date(activation.date).toISOString().substring(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].activations++;
        monthlyData[monthKey].points += activation.points || 0;
        monthlyData[monthKey].revenue += activation.price || 0;
      }
    });

    // Analizar afiliaciones por mes
    affiliations.forEach(affiliation => {
      const monthKey = new Date(affiliation.date).toISOString().substring(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].affiliations++;
      }
    });

    // Analizar transacciones por mes
    transactions.forEach(transaction => {
      const monthKey = new Date(transaction.date).toISOString().substring(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].transactions++;
      }
    });

    // Calcular métricas agregadas
    const totalActivations = Object.values(monthlyData).reduce((sum, month) => sum + month.activations, 0);
    const totalAffiliations = Object.values(monthlyData).reduce((sum, month) => sum + month.affiliations, 0);
    const totalTransactions = Object.values(monthlyData).reduce((sum, month) => sum + month.transactions, 0);
    const totalPoints = Object.values(monthlyData).reduce((sum, month) => sum + month.points, 0);

    // Calcular tendencia de actividad
    const recentMonths = Object.values(monthlyData).slice(0, 3);
    const olderMonths = Object.values(monthlyData).slice(3);
    
    const recentActivity = recentMonths.reduce((sum, month) => 
      sum + month.activations + month.affiliations, 0);
    const olderActivity = olderMonths.reduce((sum, month) => 
      sum + month.activations + month.affiliations, 0);
    
    const trend = recentActivity > olderActivity ? 'increasing' : 
                  recentActivity < olderActivity ? 'decreasing' : 'stable';

    // Score de actividad de negocio (0-100)
    const businessScore = Math.min(100,
      (totalActivations * 5) +
      (totalAffiliations * 8) +
      (totalTransactions * 3) +
      (totalPoints * 0.1)
    );

    return {
      activations: totalActivations,
      affiliations: totalAffiliations,
      transactions: totalTransactions,
      points: totalPoints,
      trend,
      businessScore: Math.round(businessScore),
      monthlyBreakdown: monthlyData
    };
  }

  // Análisis de referidos y afiliaciones
  analyzeReferrals(userId, affiliations, activations) {
    const totalAffiliations = affiliations.length;
    let activeReferrals = 0;
    let inactiveReferrals = 0;
    let totalRevenue = 0;
    let totalPoints = 0;

    // Analizar cada afiliación
    affiliations.forEach(affiliation => {
      const hasRecentActivity = activations.some(act => 
        act.userId === affiliation.userId && 
        new Date(act.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      if (hasRecentActivity) {
        activeReferrals++;
      } else {
        inactiveReferrals++;
      }

      // Calcular ingresos y puntos de la afiliación
      if (affiliation.amounts && affiliation.amounts.length > 0) {
        totalRevenue += affiliation.amounts.reduce((sum, amount) => sum + (amount || 0), 0);
      }
    });

    // Calcular métricas de calidad
    const conversionRate = totalAffiliations > 0 ? (activeReferrals / totalAffiliations) * 100 : 0;
    const qualityScore = Math.min(100,
      (activeReferrals * 15) +
      (conversionRate * 0.5) +
      (totalRevenue * 0.01)
    );

    // Score de red de referidos (0-100)
    const networkScore = Math.min(100,
      (totalAffiliations * 10) +
      (activeReferrals * 20) +
      (conversionRate * 0.3)
    );

    return {
      totalAffiliations,
      activeReferrals,
      inactiveReferrals,
      conversionRate: Math.round(conversionRate * 100) / 100,
      qualityScore: Math.round(qualityScore),
      networkScore: Math.round(networkScore),
      totalRevenue,
      totalPoints
    };
  }

  // Análisis de engagement y retención
  analyzeEngagement(user, activations, affiliations, transactions, daysSinceAffiliation) {
    const now = new Date();
    
    // Encontrar última actividad
    const allActivities = [
      ...activations.map(a => ({ date: new Date(a.date), type: 'activation' })),
      ...affiliations.map(a => ({ date: new Date(a.date), type: 'affiliation' })),
      ...transactions.map(t => ({ date: new Date(t.date), type: 'transaction' }))
    ];

    const lastActivity = allActivities.length > 0 ? 
      new Date(Math.max(...allActivities.map(a => a.date))) : null;
    
    const daysSinceLastActivity = lastActivity ? 
      Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24)) : daysSinceAffiliation;

    // Calcular frecuencia de actividad
    const totalActivities = activations.length + affiliations.length + transactions.length;
    const activityFrequency = daysSinceAffiliation > 0 ? totalActivities / daysSinceAffiliation : 0;

    // Calcular score de engagement (0-100)
    const engagementScore = Math.min(100,
      (totalActivities * 5) +
      (user.total_points * 0.01) +
      (daysSinceAffiliation > 180 ? 20 : daysSinceAffiliation > 90 ? 10 : 0) +
      (daysSinceLastActivity < 7 ? 30 : daysSinceLastActivity < 30 ? 20 : daysSinceLastActivity < 90 ? 10 : 0)
    );

    // Calcular score de retención (0-100)
    const retentionScore = Math.min(100,
      (referralAnalysis.activeReferrals > 0 ? (referralAnalysis.activeReferrals / referralAnalysis.totalAffiliations) * 50 : 0) +
      (daysSinceLastActivity < 30 ? 30 : daysSinceLastActivity < 90 ? 20 : 0) +
      (totalPoints > 1000 ? 20 : totalPoints > 500 ? 10 : 0)
    );

    return {
      lastActivity,
      daysSinceLastActivity,
      activityFrequency: Math.round(activityFrequency * 100) / 100,
      engagementScore: Math.round(engagementScore),
      retentionScore: Math.round(retentionScore),
      totalActivities
    };
  }

  // Obtener nivel del plan
  getPlanLevel(plan) {
    const planLevels = {
      'basic': 1,
      'pioneer': 2,
      'master': 3,
      'diamond': 4,
      'crown': 5
    };
    return planLevels[plan.toLowerCase()] || 1;
  }

  // Calcular tasa de crecimiento
  calculateGrowthRate(affiliations, days) {
    if (days === 0) return 0;
    const recentAffiliations = affiliations.filter(aff => 
      new Date(aff.date) > new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    );
    return recentAffiliations.length / days;
  }

  // Predicción de liderazgo usando reglas de negocio mejoradas
  predictLeadership(features) {
    let score = 0;
    
    // Factores de red (35% del score)
    if (features.network_size >= 20) score += 35;
    else if (features.network_size >= 10) score += 25;
    else if (features.network_size >= 5) score += 15;
    
    if (features.network_depth >= 3) score += 20;
    else if (features.network_depth >= 2) score += 12;
    
    if (features.network_efficiency_score >= 70) score += 15;
    else if (features.network_efficiency_score >= 50) score += 10;
    
    // Factores de actividad de negocio (30% del score)
    if (features.monthly_activations >= 5) score += 30;
    else if (features.monthly_activations >= 3) score += 20;
    else if (features.monthly_activations >= 1) score += 10;
    
    if (features.business_activity_score >= 70) score += 20;
    else if (features.business_activity_score >= 50) score += 12;
    
    // Factores de referidos y afiliaciones (20% del score)
    if (features.total_affiliations >= 8) score += 20;
    else if (features.total_affiliations >= 5) score += 15;
    else if (features.total_affiliations >= 2) score += 8;
    
    if (features.referral_network_score >= 70) score += 15;
    else if (features.referral_network_score >= 50) score += 10;
    
    // Factores de engagement (15% del score)
    if (features.engagement_score >= 70) score += 15;
    else if (features.engagement_score >= 50) score += 10;
    else if (features.engagement_score >= 30) score += 5;
    
    // Normalizar score a 0-100
    score = Math.min(100, Math.max(0, score));
    
    // Determinar nivel de liderazgo
    let level = 'Bajo';
    let probability = score / 100;
    
    if (score >= 75) {
      level = 'Alto';
    } else if (score >= 50) {
      level = 'Medio';
    }
    
    return {
      leadership_score: Math.round(score),
      leadership_level: level,
      leadership_probability: Math.round(probability * 100) / 100,
      factors: this.getLeadershipFactors(features, score)
    };
  }

  // Obtener factores que contribuyen al score
  getLeadershipFactors(features, score) {
    const factors = [];
    
    if (features.network_size >= 20) factors.push('Red grande y bien desarrollada');
    if (features.network_depth >= 3) factors.push('Red con múltiples niveles de profundidad');
    if (features.network_efficiency_score >= 70) factors.push('Alta eficiencia en la red');
    if (features.monthly_activations >= 5) factors.push('Alta actividad mensual de activaciones');
    if (features.business_activity_score >= 70) factors.push('Alto score de actividad de negocio');
    if (features.total_affiliations >= 8) factors.push('Múltiples afiliaciones exitosas');
    if (features.referral_network_score >= 70) factors.push('Excelente red de referidos');
    if (features.engagement_score >= 70) factors.push('Alto engagement con el sistema');
    if (features.days_since_affiliation >= 180) factors.push('Experiencia de 6+ meses');
    
    return factors;
  }

  // Obtener predicciones para todos los usuarios
  async getAllPredictions(page = 1, limit = 20, filter = 'all', search = '') {
    const db = await this.connect();
    
    try {
      // Construir pipeline de agregación mejorado
      const pipeline = [
        {
          $lookup: {
            from: 'affiliations',
            localField: 'id',
            foreignField: 'userId',
            as: 'affiliations'
          }
        },
        {
          $lookup: {
            from: 'activations',
            localField: 'id',
            foreignField: 'userId',
            as: 'activations'
          }
        },
        {
          $lookup: {
            from: 'transactions',
            localField: '_id',
            foreignField: 'user_id',
            as: 'transactions'
          }
        },
        {
          $lookup: {
            from: 'tree',
            localField: 'id',
            foreignField: 'id',
            as: 'tree'
          }
        },
        {
          $lookup: {
            from: 'collects',
            localField: 'id',
            foreignField: 'userId',
            as: 'collects'
          }
        },
        {
          $addFields: {
            treeData: { $arrayElemAt: ['$tree', 0] },
            affiliationCount: { $size: '$affiliations' },
            activationCount: { $size: '$activations' },
            transactionCount: { $size: '$transactions' },
            collectCount: { $size: '$collects' }
          }
        },
        {
          $project: {
            _id: 1,
            id: 1,
            name: 1,
            email: 1,
            dni: 1,
            plan: 1,
            affiliation_date: 1,
            country: 1,
            city: 1,
            points: 1,
            affiliation_points: 1,
            total_points: 1,
            affiliated: 1,
            activated: 1,
            treeData: 1,
            affiliations: 1,
            activations: 1,
            transactions: 1,
            collects: 1
          }
        }
      ];

      // Aplicar filtros de búsqueda
      if (search) {
        pipeline.unshift({
          $match: {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { dni: { $regex: search, $options: 'i' } }
            ]
          }
        });
      }

      // Ejecutar agregación
      const users = await db.collection('users').aggregate(pipeline).toArray();
      
      // Procesar cada usuario para obtener predicciones
      const predictions = [];
      for (const user of users) {
        const features = this.calculateFeatures(
          user,
          user.affiliations || [],
          user.activations || [],
          user.transactions || [],
          user.treeData || {},
          user.collects || [],
          [], // plans
          []  // products
        );
        
        const prediction = this.predictLeadership(features);
        
        predictions.push({
          ...features,
          ...prediction
        });
      }

      // Aplicar filtros de nivel
      let filteredPredictions = predictions;
      if (filter !== 'all') {
        const levelMap = {
          'high': 'Alto',
          'medium': 'Medio',
          'low': 'Bajo'
        };
        filteredPredictions = predictions.filter(p => p.leadership_level === levelMap[filter]);
      }

      // Aplicar paginación
      const total = filteredPredictions.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPredictions = filteredPredictions.slice(startIndex, endIndex);

      // Calcular estadísticas
      const stats = {
        total_users: total,
        high_potential: filteredPredictions.filter(p => p.leadership_level === 'Alto').length,
        medium_potential: filteredPredictions.filter(p => p.leadership_level === 'Medio').length,
        low_potential: filteredPredictions.filter(p => p.leadership_level === 'Bajo').length,
        avg_score: total > 0 ? Math.round(filteredPredictions.reduce((sum, p) => sum + p.leadership_score, 0) / total * 100) / 100 : 0,
        max_score: total > 0 ? Math.max(...filteredPredictions.map(p => p.leadership_score)) : 0
      };

      return {
        success: true,
        data: {
          users: paginatedPredictions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          },
          stats
        }
      };

    } catch (error) {
      console.error('Error obteniendo predicciones:', error);
      throw error;
    }
  }

  // Obtener predicción para un usuario específico
  async getUserPrediction(userId) {
    const features = await this.extractUserFeatures(userId);
    if (!features) return null;
    
    const prediction = this.predictLeadership(features);
    return {
      ...features,
      ...prediction
    };
  }

  // Actualizar predicciones en batch
  async updateBatchPredictions() {
    const db = await this.connect();
    
    try {
      const users = await db.collection('users').find({}).toArray();
      const updates = [];
      
      for (const user of users) {
        const features = await this.extractUserFeatures(user._id);
        if (features) {
          const prediction = this.predictLeadership(features);
          
          updates.push({
            updateOne: {
              filter: { _id: user._id },
              update: {
                $set: {
                  leadership_score: prediction.leadership_score,
                  leadership_level: prediction.leadership_level,
                  leadership_probability: prediction.leadership_probability,
                  leadership_factors: prediction.factors,
                  last_prediction_update: new Date()
                }
              }
            }
          });
        }
      }
      
      if (updates.length > 0) {
        await db.collection('users').bulkWrite(updates);
        console.log(`Actualizadas ${updates.length} predicciones de liderazgo`);
      }
      
      return updates.length;
    } catch (error) {
      console.error('Error actualizando predicciones en batch:', error);
      throw error;
    }
  }
}

export default new MLMPredictionService(); 