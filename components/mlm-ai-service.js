import { connectDB } from './db-connect';
// Cargar variables de entorno desde .env en cualquier modo (dev/prod)
require('dotenv').config();
const _fetch = typeof fetch === 'function' ? fetch : require('node-fetch');

class MLMAIService {
  constructor() {
    this.db = null;
    this.pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';
  }

  async connect() {
    if (!this.db) {
      this.db = await connectDB();
    }
    return this.db;
  }

  // Verificar estado del modelo de IA
  async checkAIHealth() {
    try {
      const responseHealth = await _fetch(`${this.pythonApiUrl}/health`);
      const healthData = await responseHealth.json();

      // Intentar obtener información detallada del modelo
      let algorithm = 'No disponible';
      try {
        const responseInfo = await _fetch(`${this.pythonApiUrl}/model/info`);
        if (responseInfo.ok) {
          const infoJson = await responseInfo.json();
          const infoData = infoJson.data || infoJson;
          algorithm = infoData.model_algorithm || infoData.algorithm || infoData.classifier || infoData.model_type || infoData.model_name || algorithm;
        }
      } catch (e) {
        // Silenciar errores de info, la salud es suficiente
      }

      return {
        healthy: healthData.status === 'healthy',
        algorithm,
        features_count: healthData.features_count
      };
    } catch (error) {
      console.error('Error checking AI health:', error);
      return {
        healthy: false,
        algorithm: 'No disponible',
        features_count: 0
      };
    }
  }

  // Extraer features para el modelo de IA
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

      // Calcular features para el modelo de IA
      const features = this.calculateAIFeatures(user, affiliations, activations, transactions, treeData, collects);
      
      return features;
    } catch (error) {
      console.error('Error extrayendo features para IA:', error);
      return null;
    }
  }

  // Calcular features específicas para el modelo de IA
  calculateAIFeatures(user, affiliations, activations, transactions, treeData, collects) {
    const now = new Date();
    const affiliationDate = user.affiliation_date ? new Date(user.affiliation_date) : now;
    const daysSinceAffiliation = Math.floor((now - affiliationDate) / (1000 * 60 * 60 * 24));

    // Features básicas del usuario
    const planLevel = this.getPlanLevel(user.plan || 'basic');
    const points = user.points || 0;
    const affiliationPoints = user.affiliation_points || 0;

    // Features de red
    const networkAnalysis = this.analyzeNetwork(user.id, treeData, activations, affiliations);
    
    // Ventana para actividad mensual
    const monthsWindow = 6;
    // Features de actividad por mes
    const monthlyActivity = this.analyzeMonthlyActivity(activations, affiliations, transactions, monthsWindow);
    // Derivar promedios mensuales
    const monthlyActivationsAvg = monthlyActivity.activations / Math.max(1, monthsWindow);
    const monthlyAffiliationsAvg = monthlyActivity.affiliations / Math.max(1, monthsWindow);
    // Consistencia de actividad (0-1), más exigente hacia 3 activaciones/mes
    const activityConsistency = Math.min(1, monthlyActivationsAvg / 3);
    // Indicador: al menos 4 directos y ambos (activaciones y afiliaciones) presentes
    const teamCoactivation4plus = (networkAnalysis.directChildren >= 4 && monthlyActivationsAvg >= 1 && monthlyAffiliationsAvg >= 1) ? 1 : 0;
    
    // Features de afiliaciones y referidos
    const referralAnalysis = this.analyzeReferrals(user.id, affiliations, activations);
    
    // Features de engagement
    const engagementAnalysis = this.analyzeEngagement(user, activations, affiliations, transactions, daysSinceAffiliation);

    // Calcular valores de transacciones
    const totalTransactionValue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const avgTransactionValue = transactions.length > 0 ? totalTransactionValue / transactions.length : 0;
    
    // Calcular valores de afiliaciones
    const totalAffiliationValue = affiliations.reduce((sum, a) => sum + (a.amount || 0), 0);
    const avgAffiliationValue = affiliations.length > 0 ? totalAffiliationValue / affiliations.length : 0;
    
    // Calcular valores de activaciones
    const totalActivationValue = activations.reduce((sum, a) => sum + (a.amount || 0), 0);
    const avgActivationValue = activations.length > 0 ? totalActivationValue / activations.length : 0;
    
    // Calcular valores de recolecciones
    const totalCollectValue = collects.reduce((sum, c) => sum + (c.amount || 0), 0);
    const avgCollectValue = collects.length > 0 ? totalCollectValue / collects.length : 0;

    // Calcular frecuencia de afiliaciones
    const affiliationFrequency = affiliations.length / Math.max(1, daysSinceAffiliation / 30);

    // Calcular potencial de crecimiento
    const growthPotential = Math.min(100, (
      (networkAnalysis.totalNetworkSize * 10) + 
      (engagementAnalysis.engagementScore * 0.5) + 
      (monthlyActivity.activations * 5)
    ));

    // Calcular score de liderazgo
    const leadershipScore = Math.min(100, (
      (planLevel * 10) + 
      (networkAnalysis.totalNetworkSize * 2) + 
      (engagementAnalysis.engagementScore * 0.3) + 
      (monthlyActivity.activations * 3)
    ));

    // Asegurar que todos los valores sean números válidos (no NaN, null, undefined)
    const safeValue = (value) => {
      if (value === null || value === undefined || isNaN(value)) {
        return 0;
      }
      return Number(value);
    };

    // Retornar features en el formato exacto esperado por el modelo .pkl
    return {
      plan_level: safeValue(planLevel),
      days_since_affiliation: safeValue(daysSinceAffiliation),
      points: safeValue(points),
      affiliation_points: safeValue(affiliationPoints),
      network_level: safeValue(networkAnalysis.level),
      network_depth: safeValue(networkAnalysis.maxDepth),
      children_count: safeValue(networkAnalysis.directChildren),
      network_size: safeValue(networkAnalysis.totalNetworkSize),

      // NUEVAS VARIABLES centradas en actividad mensual y trabajo en equipo
      monthly_activations: safeValue(monthlyActivationsAvg),
      monthly_affiliations: safeValue(monthlyAffiliationsAvg),
      activity_consistency: safeValue(activityConsistency),
      team_coactivation_4plus: safeValue(teamCoactivation4plus),

      // Variables de referidos y actividad reciente
      referrals_direct: safeValue(referralAnalysis.activeReferrals),
      referrals_indirect: safeValue(referralAnalysis.inactiveReferrals),
      recent_activity_days: safeValue(engagementAnalysis.daysSinceLastActivity),

      // Transacciones (se calculan pero el modelo de calidad las ignora)
      total_transactions: safeValue(transactions.length),
      total_transaction_value: safeValue(totalTransactionValue),
      avg_transaction_value: safeValue(avgTransactionValue),

      // Afiliaciones
      total_affiliations: safeValue(affiliations.length),
      total_affiliation_value: safeValue(totalAffiliationValue),
      avg_affiliation_value: safeValue(avgAffiliationValue),
      affiliation_frequency: safeValue(affiliationFrequency),

      // Activaciones
      total_activations: safeValue(activations.length),
      total_activation_value: safeValue(totalActivationValue),
      avg_activation_value: safeValue(avgActivationValue),

      // Recolecciones
      total_collects: safeValue(collects.length),
      total_collect_value: safeValue(totalCollectValue),
      avg_collect_value: safeValue(avgCollectValue),

      // Engagement y crecimiento
      engagement_score: safeValue(engagementAnalysis.engagementScore),
      growth_potential: safeValue(growthPotential),
      leadership_score: safeValue(leadershipScore),

      // Placeholders de árbol (si el modelo los requiere)
      tree_branching_factor: 0,
      children_growth_rate: 0
    };
  }

  // Análisis de red (reutilizado del servicio existente)
  analyzeNetwork(userId, treeData, activations, affiliations) {
    if (!treeData || !treeData.childs) {
      return {
        level: 1,
        directChildren: 0,
        totalNetworkSize: 0,
        maxDepth: 0,
        coverage: 0,
        efficiency: 0
      };
    }

    const directChildren = treeData.childs.length;
    let totalNetworkSize = directChildren;
    let maxDepth = 1;
    let activeMembers = 0;
    let totalMembers = 0;

    const calculateNetworkDepth = (children, depth = 1) => {
      if (!children || children.length === 0) return depth;
      
      maxDepth = Math.max(maxDepth, depth);
      totalMembers += children.length;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      children.forEach(childId => {
        const hasRecentActivity = activations.some(act => 
          act.userId === childId && new Date(act.date) > thirtyDaysAgo
        );
        if (hasRecentActivity) activeMembers++;
      });
    };

    calculateNetworkDepth(treeData.childs);
    
    const coverage = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
    const efficiency = directChildren > 0 ? totalNetworkSize / directChildren : 0;

    return {
      level: maxDepth,
      directChildren,
      totalNetworkSize: totalMembers,
      maxDepth,
      coverage: Math.round(coverage * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100
    };
  }

  // Análisis de actividad mensual (reutilizado)
  analyzeMonthlyActivity(activations, affiliations, transactions, months) {
    const monthlyData = {};
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().substring(0, 7);
      monthlyData[monthKey] = {
        activations: 0,
        affiliations: 0,
        transactions: 0,
        points: 0
      };
    }

    activations.forEach(activation => {
      const monthKey = new Date(activation.date).toISOString().substring(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].activations++;
        monthlyData[monthKey].points += activation.points || 0;
      }
    });

    affiliations.forEach(affiliation => {
      const monthKey = new Date(affiliation.date).toISOString().substring(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].affiliations++;
      }
    });

    transactions.forEach(transaction => {
      const monthKey = new Date(transaction.date).toISOString().substring(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].transactions++;
      }
    });

    const totalActivations = Object.values(monthlyData).reduce((sum, month) => sum + month.activations, 0);
    const totalAffiliations = Object.values(monthlyData).reduce((sum, month) => sum + month.affiliations, 0);
    const totalTransactions = Object.values(monthlyData).reduce((sum, month) => sum + month.transactions, 0);
    const totalPoints = Object.values(monthlyData).reduce((sum, month) => sum + month.points, 0);

    return {
      activations: totalActivations,
      affiliations: totalAffiliations,
      transactions: totalTransactions,
      points: totalPoints
    };
  }

  // Análisis de referidos (reutilizado)
  analyzeReferrals(userId, affiliations, activations) {
    const totalAffiliations = affiliations.length;
    let activeReferrals = 0;
    let inactiveReferrals = 0;

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
    });

    const conversionRate = totalAffiliations > 0 ? (activeReferrals / totalAffiliations) * 100 : 0;

    return {
      totalAffiliations,
      activeReferrals,
      inactiveReferrals,
      conversionRate: Math.round(conversionRate * 100) / 100
    };
  }

  // Análisis de engagement (reutilizado)
  analyzeEngagement(user, activations, affiliations, transactions, daysSinceAffiliation) {
    const now = new Date();
    
    // Asegurar que user.total_points sea un número válido
    const totalPoints = user.total_points || user.points || 0;
    
    const allActivities = [
      ...activations.map(a => ({ date: new Date(a.date || a.createdAt || now), type: 'activation' })),
      ...affiliations.map(a => ({ date: new Date(a.date || a.createdAt || now), type: 'affiliation' })),
      ...transactions.map(t => ({ date: new Date(t.date || t.createdAt || now), type: 'transaction' }))
    ];

    const lastActivity = allActivities.length > 0 ? 
      new Date(Math.max(...allActivities.map(a => a.date))) : now;
    
    const daysSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

    const totalActivities = activations.length + affiliations.length + transactions.length;
    const activityFrequency = daysSinceAffiliation > 0 ? totalActivities / daysSinceAffiliation : 0;

    const engagementScore = Math.min(100, Math.max(0,
      (totalActivities * 5) +
      (totalPoints * 0.01) +
      (daysSinceAffiliation > 180 ? 20 : daysSinceAffiliation > 90 ? 10 : 0) +
      (daysSinceLastActivity < 7 ? 30 : daysSinceLastActivity < 30 ? 20 : daysSinceLastActivity < 90 ? 10 : 0)
    ));

    const retentionScore = Math.min(100, Math.max(0,
      (daysSinceLastActivity < 30 ? 30 : daysSinceLastActivity < 90 ? 20 : 0) +
      (totalPoints > 1000 ? 20 : totalPoints > 500 ? 10 : 0)
    ));

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

  // Predicción usando el modelo de IA
  async predictWithAIModel(features) {
    try {
      const timeoutMs = 10000;
      const hasAbort = typeof AbortController !== 'undefined';
      const controller = hasAbort ? new AbortController() : null;
      let timeoutId;
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      const response = await _fetch(`${this.pythonApiUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(features),
        signal: controller ? controller.signal : undefined,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text || 'Error en predicción de IA'}`);
      }

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || 'Error en predicción de IA');
      }

      return json.data;
    } catch (error) {
      console.error('Error en predicción de IA:', error);
      throw error;
    }
  }

  // Normalizar probabilidades extremas del modelo
  normalizeProbabilities(aiPrediction) {
    const probabilities = aiPrediction.probabilities || {};
    const originalProbability = aiPrediction.probability || 0;
    const level = aiPrediction.leadership_level || 'Bajo';

    // Asegurar que existan todas las llaves y que sumen 1
    let normalizedProbs = {
      Bajo: typeof probabilities.Bajo === 'number' ? probabilities.Bajo : 0,
      Medio: typeof probabilities.Medio === 'number' ? probabilities.Medio : 0,
      Alto: typeof probabilities.Alto === 'number' ? probabilities.Alto : 0,
    };

    let total = Object.values(normalizedProbs).reduce((sum, val) => sum + val, 0);

    // Si el modelo no entregó una distribución válida, crear una determinística basada en el nivel
    if (total <= 0) {
      if (level === 'Alto') {
        normalizedProbs = { Bajo: 0.05, Medio: 0.15, Alto: 0.8 };
      } else if (level === 'Medio') {
        normalizedProbs = { Bajo: 0.1, Medio: 0.8, Alto: 0.1 };
      } else {
        normalizedProbs = { Bajo: 0.8, Medio: 0.15, Alto: 0.05 };
      }
      total = 1;
    }

    // Normalizar para que sumen 1
    if (Math.abs(total - 1) > 1e-6) {
      Object.keys(normalizedProbs).forEach(key => {
        normalizedProbs[key] = normalizedProbs[key] / (total || 1);
      });
    }

    // Manejar casos extremos (>0.99) SIN ruido aleatorio
    if (originalProbability > 0.99) {
      if (level === 'Alto') {
        normalizedProbs = { Bajo: 0.02, Medio: 0.03, Alto: 0.95 };
      } else if (level === 'Medio') {
        normalizedProbs = { Bajo: 0.05, Medio: 0.9, Alto: 0.05 };
      } else {
        normalizedProbs = { Bajo: 0.95, Medio: 0.03, Alto: 0.02 };
      }
    }

    return {
      ...aiPrediction,
      probabilities: normalizedProbs,
      probability: aiPrediction.probability,
      normalized_probability: normalizedProbs[level] || originalProbability,
    };
  }

  // Calcular ranking inteligente para identificar líderes
  calculateAIRanking(features, aiPrediction) {
    const probability = aiPrediction.normalized_probability || aiPrediction.probability || 0;
    const level = aiPrediction.leadership_level || 'Bajo';
    
    // Score base: probabilidad de IA (0-100)
    let leadershipScore = probability * 100;
    
    // FACTOR 1: Red MLM (30 puntos máximo)
    const networkSize = features.network_size || 0;
    const networkDepth = features.network_depth || 0;
    const childrenCount = features.children_count || 0;
    
    let networkScore = 0;
    if (networkSize >= 50) networkScore += 15;
    else if (networkSize >= 30) networkScore += 12;
    else if (networkSize >= 20) networkScore += 10;
    else if (networkSize >= 10) networkScore += 8;
    else if (networkSize >= 5) networkScore += 5;
    
    if (networkDepth >= 4) networkScore += 10;
    else if (networkDepth >= 3) networkScore += 8;
    else if (networkDepth >= 2) networkScore += 5;
    
    if (childrenCount >= 10) networkScore += 5;
    else if (childrenCount >= 5) networkScore += 3;
    else if (childrenCount >= 2) networkScore += 1;
    
    // FACTOR 2: Actividad y Engagement (25 puntos máximo)
    const monthlyActivations = features.monthly_activations || 0;
    const monthlyAffiliations = features.monthly_affiliations || 0;
    const engagementScore = features.engagement_score || 0;
    const totalActivations = features.total_activations || 0;
    
    let activityScore = 0;
    if (monthlyActivations >= 10) activityScore += 8;
    else if (monthlyActivations >= 5) activityScore += 6;
    else if (monthlyActivations >= 3) activityScore += 4;
    else if (monthlyActivations >= 1) activityScore += 2;
    
    if (monthlyAffiliations >= 5) activityScore += 7;
    else if (monthlyAffiliations >= 3) activityScore += 5;
    else if (monthlyAffiliations >= 1) activityScore += 3;
    
    if (engagementScore >= 80) activityScore += 5;
    else if (engagementScore >= 60) activityScore += 3;
    else if (engagementScore >= 40) activityScore += 1;
    
    if (totalActivations >= 20) activityScore += 5;
    else if (totalActivations >= 10) activityScore += 3;
    else if (totalActivations >= 5) activityScore += 1;
    
    // FACTOR 3: Plan y Antigüedad (20 puntos máximo)
    const planLevel = features.plan_level || 1;
    const daysSinceAffiliation = features.days_since_affiliation || 0;
    const points = features.points || 0;
    
    let planScore = 0;
    if (planLevel >= 5) planScore += 10; // Crown
    else if (planLevel >= 4) planScore += 8; // Diamond
    else if (planLevel >= 3) planScore += 6; // Master
    else if (planLevel >= 2) planScore += 4; // Pioneer
    else planScore += 2; // Basic
    
    if (daysSinceAffiliation >= 365) planScore += 5; // Más de 1 año
    else if (daysSinceAffiliation >= 180) planScore += 3; // Más de 6 meses
    else if (daysSinceAffiliation >= 90) planScore += 1; // Más de 3 meses
    
    if (points >= 5000) planScore += 5;
    else if (points >= 2000) planScore += 3;
    else if (points >= 500) planScore += 1;
    
    // FACTOR 4: Potencial de Crecimiento (15 puntos máximo)
    const growthPotential = features.growth_potential || 0;
    const leadershipScoreFeature = features.leadership_score || 0;
    const totalAffiliations = features.total_affiliations || 0;
    
    let growthScore = 0;
    if (growthPotential >= 80) growthScore += 5;
    else if (growthPotential >= 60) growthScore += 3;
    else if (growthPotential >= 40) growthScore += 1;
    
    if (leadershipScoreFeature >= 80) growthScore += 5;
    else if (leadershipScoreFeature >= 60) growthScore += 3;
    else if (leadershipScoreFeature >= 40) growthScore += 1;
    
    if (totalAffiliations >= 10) growthScore += 5;
    else if (totalAffiliations >= 5) growthScore += 3;
    else if (totalAffiliations >= 2) growthScore += 1;
    
    // FACTOR 5: Consistencia y Retención (10 puntos máximo)
    const retentionScore = features.retention_score || 0;
    const activityFrequency = features.activity_frequency || 0;
    
    let consistencyScore = 0;
    if (retentionScore >= 80) consistencyScore += 5;
    else if (retentionScore >= 60) consistencyScore += 3;
    else if (retentionScore >= 40) consistencyScore += 1;
    
    if (activityFrequency >= 0.8) consistencyScore += 5;
    else if (activityFrequency >= 0.5) consistencyScore += 3;
    else if (activityFrequency >= 0.2) consistencyScore += 1;
    
    // CALCULAR SCORE TOTAL
    const totalScore = Math.min(100, 
      leadershipScore * 0.3 + // 30% peso a la predicción de IA
      networkScore + // 30% peso a la red
      activityScore + // 25% peso a la actividad
      planScore + // 20% peso al plan y antigüedad
      growthScore + // 15% peso al potencial
      consistencyScore // 10% peso a la consistencia
    );
    
    // BONUS ESPECIAL: Multiplicador por nivel de liderazgo (reducido para evitar saturación)
    let finalScore = totalScore;
    if (level === 'Alto') finalScore *= 1.05; // antes 1.2
    else if (level === 'Medio') finalScore *= 1.02; // antes 1.1
    
    // Convertir a ranking (1-395, donde 1 es el mejor)
    const finalRanking = Math.max(1, Math.ceil((100 - finalScore) * 3.95) + 1);
    
    return finalRanking;
  }

  // Obtener categoría de ranking
  getRankingCategory(ranking) {
    if (ranking <= 10) return 'Top 10';
    if (ranking <= 25) return 'Top 25';
    if (ranking <= 50) return 'Top 50';
    if (ranking <= 100) return 'Top 100';
    if (ranking <= 200) return 'Top 200';
    return 'Top 395';
  }

  // Calcular score de liderazgo para mostrar en la interfaz
  calculateLeadershipScore(features, aiPrediction) {
    const probability = aiPrediction.normalized_probability || aiPrediction.probability || 0;
    const level = aiPrediction.leadership_level || 'Bajo';
    
    // Score base: probabilidad de IA (0-100)
    let leadershipScore = probability * 100;
    
    // Bonus por red grande (valores más conservadores)
    const networkSize = features.network_size || 0;
    if (networkSize >= 50) leadershipScore += 12;
    else if (networkSize >= 30) leadershipScore += 9;
    else if (networkSize >= 20) leadershipScore += 7;
    else if (networkSize >= 10) leadershipScore += 5;
    else if (networkSize >= 5) leadershipScore += 3;
    
    // Bonus por actividad (más conservador)
    const monthlyActivations = features.total_activations || 0;
    if (monthlyActivations >= 10) leadershipScore += 8;
    else if (monthlyActivations >= 5) leadershipScore += 6;
    else if (monthlyActivations >= 3) leadershipScore += 4;
    else if (monthlyActivations >= 1) leadershipScore += 2;
    
    // Bonus por plan
    const planLevel = features.plan_level || 1;
    if (planLevel >= 5) leadershipScore += 8; // Crown
    else if (planLevel >= 4) leadershipScore += 6; // Diamond
    else if (planLevel >= 3) leadershipScore += 4; // Master
    else if (planLevel >= 2) leadershipScore += 3; // Pioneer
    else leadershipScore += 2; // Basic
    
    // Bonus por engagement
    const engagementScore = features.engagement_score || 0;
    if (engagementScore >= 80) leadershipScore += 6;
    else if (engagementScore >= 60) leadershipScore += 4;
    else if (engagementScore >= 40) leadershipScore += 2;
    
    // Eliminar multiplicador por nivel para evitar saturación del 100
    // if (level === 'Alto') leadershipScore *= 1.2;
    // else if (level === 'Medio') leadershipScore *= 1.1;
    
    return Math.round(Math.min(100, leadershipScore));
  }

  // Obtener medalla basada en potencial de liderazgo
  getMedal(aiPrediction, features) {
    const probability = aiPrediction.normalized_probability || aiPrediction.probability || 0;
    const networkSize = features.network_size || 0;
    const monthlyActivations = features.monthly_activations || 0;
    const planLevel = features.plan_level || 1;
    const engagementScore = features.engagement_score || 0;
    
    // Calcular score de liderazgo
    let leadershipScore = 0;
    
    // Red MLM (40% del score)
    if (networkSize >= 50) leadershipScore += 40;
    else if (networkSize >= 30) leadershipScore += 35;
    else if (networkSize >= 20) leadershipScore += 30;
    else if (networkSize >= 10) leadershipScore += 25;
    else if (networkSize >= 5) leadershipScore += 20;
    else if (networkSize >= 2) leadershipScore += 15;
    
    // Actividad (30% del score)
    if (monthlyActivations >= 10) leadershipScore += 30;
    else if (monthlyActivations >= 5) leadershipScore += 25;
    else if (monthlyActivations >= 3) leadershipScore += 20;
    else if (monthlyActivations >= 1) leadershipScore += 15;
    
    // Plan y antigüedad (20% del score)
    if (planLevel >= 5) leadershipScore += 20; // Crown
    else if (planLevel >= 4) leadershipScore += 18; // Diamond
    else if (planLevel >= 3) leadershipScore += 15; // Master
    else if (planLevel >= 2) leadershipScore += 12; // Pioneer
    else leadershipScore += 10; // Basic
    
    // Engagement (10% del score)
    if (engagementScore >= 80) leadershipScore += 10;
    else if (engagementScore >= 60) leadershipScore += 8;
    else if (engagementScore >= 40) leadershipScore += 5;
    
    // Asignar medallas basadas en el score total
    if (leadershipScore >= 90) return '👑 Corona Real';
    if (leadershipScore >= 80) return '🥇 Oro Elite';
    if (leadershipScore >= 70) return '🥈 Plata Premium';
    if (leadershipScore >= 60) return '🥉 Bronce Plus';
    if (leadershipScore >= 50) return '⭐ Estrella Dorada';
    if (leadershipScore >= 40) return '🔶 Diamante';
    if (leadershipScore >= 30) return '💎 Cristal';
    if (leadershipScore >= 20) return '🌟 Estrella';
    return '✨ Novato';
  }

  // Obtener todas las predicciones de IA
  async getAllAIPredictions(page = 1, limit = 20, filter = 'all', search = '') {
    const db = await this.connect();
    
    try {
      // Construir pipeline de agregación
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
            treeData: { $arrayElemAt: ['$tree', 0] }
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
      
      // Procesar cada usuario para obtener predicciones de IA
      const predictions = [];
      for (const user of users) {
        try {
          const features = this.calculateAIFeatures(
            user,
            user.affiliations || [],
            user.activations || [],
            user.transactions || [],
            user.treeData || {},
            user.collects || []
          );
          
                // Obtener predicción del modelo de IA
      const aiPrediction = await this.predictWithAIModel(features);
      
      // Normalizar probabilidades si son muy extremas
      const normalizedPrediction = this.normalizeProbabilities(aiPrediction);
      
      // Calcular ranking y medalla
      const ranking = this.calculateAIRanking(features, normalizedPrediction);
      const rankingCategory = this.getRankingCategory(ranking);
      const medal = this.getMedal(normalizedPrediction, features);
          
          // Calcular score de liderazgo para mostrar en la interfaz
          const leadershipScore = this.calculateLeadershipScore(features, normalizedPrediction);

          // Normalizar potencial de crecimiento para evitar que sea siempre 100 en la interfaz
          const uiGrowthPotential = Math.min(100,
            40 * Math.min((features.network_size || 0) / 50, 1) +
            30 * Math.min((features.engagement_score || 0) / 100, 1) +
            30 * Math.min((features.total_activations || 0) / 20, 1)
          );
          
          predictions.push({
            user_id: user._id,
            name: user.name || user.username,
            email: user.email,
            dni: user.dni,
            plan_name: user.plan,
            ...features,
            // Sobrescribir potencial de crecimiento para la salida (sin afectar el payload del modelo)
            growth_potential: Math.round(uiGrowthPotential),
            ...normalizedPrediction,
            ranking,
            ranking_category: rankingCategory,
            medal,
            leadership_score: leadershipScore,
            created_at: new Date()
          });
        } catch (error) {
          console.error(`Error procesando usuario ${user._id}:`, error);
          // Continuar con el siguiente usuario
        }
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

      // Ordenar por potencial de liderazgo (mejor primero)
      filteredPredictions.sort((a, b) => {
        // 1. Primero por nivel de liderazgo (Alto > Medio > Bajo)
        const levelOrder = { 'Alto': 3, 'Medio': 2, 'Bajo': 1 };
        const levelA = levelOrder[a.leadership_level] || 0;
        const levelB = levelOrder[b.leadership_level] || 0;
        
        if (levelA !== levelB) {
          return levelB - levelA; // Alto primero
        }
        
        // 2. Luego por ranking (menor número = mejor)
        const rankingA = a.ranking || 999;
        const rankingB = b.ranking || 999;
        
        if (rankingA !== rankingB) {
          return rankingA - rankingB;
        }
        
        // 3. Luego por tamaño de red (mayor = mejor)
        const networkA = a.network_size || 0;
        const networkB = b.network_size || 0;
        
        if (networkA !== networkB) {
          return networkB - networkA;
        }
        
        // 4. Luego por actividad mensual (mayor = mejor)
        const activityA = a.monthly_activations || 0;
        const activityB = b.monthly_activations || 0;
        
        if (activityA !== activityB) {
          return activityB - activityA;
        }
        
        // 5. Finalmente por probabilidad (mayor = mejor)
        const probabilityA = a.probability || 0;
        const probabilityB = b.probability || 0;
        
        return probabilityB - probabilityA;
      });

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
        avg_probability: total > 0 ? Math.round(filteredPredictions.reduce((sum, p) => sum + (p.probability || 0), 0) / total * 100) : 0
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
      console.error('Error obteniendo predicciones de IA:', error);
      throw error;
    }
  }

  // Actualizar predicciones de IA en batch
  async updateBatchAIPredictions() {
    const db = await this.connect();
    
    try {
      const users = await db.collection('users').find({}).toArray();
      const updates = [];
      let processedCount = 0;
      
      for (const user of users) {
        try {
          const features = await this.extractUserFeatures(user._id);
          if (features) {
            const aiPrediction = await this.predictWithAIModel(features);
            const ranking = this.calculateAIRanking(features, aiPrediction);
            const rankingCategory = this.getRankingCategory(ranking);
            const medal = this.getMedal(aiPrediction, features);
            
            updates.push({
              updateOne: {
                filter: { _id: user._id },
                update: {
                  $set: {
                    ai_leadership_score: aiPrediction.probability * 100,
                    ai_leadership_level: aiPrediction.leadership_level,
                    ai_leadership_probability: aiPrediction.probability,
                    ai_leadership_ranking: ranking,
                    ai_leadership_category: rankingCategory,
                    ai_leadership_medal: medal,
                    ai_leadership_probabilities: aiPrediction.probabilities,
                    last_ai_prediction_update: new Date()
                  }
                }
              }
            });
            
            processedCount++;
          }
        } catch (error) {
          console.error(`Error procesando usuario ${user._id} en batch:`, error);
          // Continuar con el siguiente usuario
        }
      }
      
      if (updates.length > 0) {
        await db.collection('users').bulkWrite(updates);
        console.log(`✅ Actualizadas ${updates.length} predicciones de IA en batch`);
      }
      
      return { count: processedCount };
    } catch (error) {
      console.error('Error actualizando predicciones de IA en batch:', error);
      throw error;
    }
  }
}

export default new MLMAIService();