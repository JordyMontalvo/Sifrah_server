package main

import (
	"fmt"

	"sifrah/cierre_engine/models"
)

// Razón registrada al dar de baja en el cierre a un registrado sin compra de afiliación.
const reasonNotAffiliated = "Cierre automático: Usuario no afiliado"

// closeEliminationReason decide si una cuenta se da de baja en el cierre de mes.
// Devuelve la razón de la baja, o "" si la cuenta se conserva.
//
// Reglas de permanencia de códigos:
//   - Registrado SIN compra de afiliación: se da de baja en el cierre (punto 1).
//   - Afiliado (compra de afiliación aprobada): código PERMANENTE. Nunca se da de
//     baja por inactividad, sin importar cuántos cierres lleve sin puntos (punto 2).
//   - Cuentas admin y ya eliminadas quedan fuera del proceso.
func closeEliminationReason(user *models.User) string {
	if user.Status == "eliminated" {
		return ""
	}
	if user.UserType == "admin" || user.ID == "admin" {
		return ""
	}
	if !user.Affiliated {
		return reasonNotAffiliated
	}
	return ""
}

// eliminateUser marca la cuenta como eliminada y libera sus credenciales
// (DNI/email/teléfono con prefijo del_<ts>_) para permitir un nuevo registro.
func eliminateUser(user *models.User, reason string, ts int64) {
	user.Status = "eliminated"
	user.StatusReason = reason
	user.DNI = fmt.Sprintf("del_%d_%s", ts, user.DNI)
	if user.Email != "" {
		user.Email = fmt.Sprintf("del_%d_%s", ts, user.Email)
	}
	if user.Phone != "" {
		user.Phone = fmt.Sprintf("del_%d_%s", ts, user.Phone)
	}
	user.Name = user.Name + " (Eliminado)"
}
