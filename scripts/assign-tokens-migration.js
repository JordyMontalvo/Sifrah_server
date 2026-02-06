import db from "../components/db.js"
import lib from "../components/lib.js"

const { User } = db

async function assignTokensToUsers() {
  console.log('🔧 Iniciando migración: Asignar tokens a usuarios sin token...')
  
  try {
    // Buscar todos los usuarios que no tienen token o tienen token null
    const usersWithoutToken = await User.find({ 
      $or: [
        { token: null },
        { token: { $exists: false } }
      ]
    })
    
    console.log(`📊 Usuarios sin token encontrados: ${usersWithoutToken.length}`)
    
    if (usersWithoutToken.length === 0) {
      console.log('✅ Todos los usuarios ya tienen token asignado')
      return
    }
    
    let successCount = 0
    let errorCount = 0
    
    for (const user of usersWithoutToken) {
      try {
        // Generar un token único
        let token = null
        let attempts = 0
        const maxAttempts = 10
        
        while (!token && attempts < maxAttempts) {
          const generatedToken = lib.generateToken()
          const existingToken = await User.findOne({ token: generatedToken })
          if (!existingToken) {
            token = generatedToken
          }
          attempts++
        }
        
        if (token) {
          // Actualizar el usuario con el nuevo token
          await User.update({ id: user.id }, { token })
          console.log(`✓ Token asignado a ${user.name} ${user.lastName} (${user.dni}): ${token}`)
          successCount++
        } else {
          console.error(`✗ No se pudo generar token único para ${user.name} ${user.lastName} (${user.dni})`)
          errorCount++
        }
        
      } catch (err) {
        console.error(`✗ Error al asignar token a ${user.name} ${user.lastName}:`, err.message)
        errorCount++
      }
    }
    
    console.log('\n📈 Resumen de migración:')
    console.log(`   ✅ Tokens asignados exitosamente: ${successCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)
    console.log('🎉 Migración completada')
    
  } catch (error) {
    console.error('❌ Error en la migración:', error)
  }
  
  process.exit(0)
}

// Ejecutar la migración
assignTokensToUsers()
