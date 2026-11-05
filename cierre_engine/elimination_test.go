package main

import (
	"strings"
	"testing"

	"sifrah/cierre_engine/models"
)

func TestCloseEliminationReason(t *testing.T) {
	cases := []struct {
		name string
		user models.User
		want string
	}{
		{"no afiliado se da de baja", models.User{ID: "u1", Affiliated: false}, reasonNotAffiliated},
		{"afiliado activo se conserva", models.User{ID: "u2", Affiliated: true}, ""},
		{"afiliado con 6 cierres sin puntos se conserva (codigo permanente)", models.User{ID: "u3", Affiliated: true, NInactives: 6}, ""},
		{"afiliado con años sin puntos se conserva", models.User{ID: "u4", Affiliated: true, NInactives: 48}, ""},
		{"admin por tipo excluido", models.User{ID: "u5", UserType: "admin"}, ""},
		{"admin por id excluido", models.User{ID: "admin"}, ""},
		{"ya eliminado no se reprocesa", models.User{ID: "u6", Status: "eliminated"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			u := c.user
			if got := closeEliminationReason(&u); got != c.want {
				t.Fatalf("closeEliminationReason() = %q, want %q", got, c.want)
			}
		})
	}
}

func TestEliminateUser(t *testing.T) {
	u := models.User{ID: "u1", DNI: "12345678", Email: "a@b.com", Phone: "", Name: "Ana"}
	eliminateUser(&u, reasonNotAffiliated, 1700000000)

	if u.Status != "eliminated" || u.StatusReason != reasonNotAffiliated {
		t.Fatalf("status/reason = %q/%q", u.Status, u.StatusReason)
	}
	if u.DNI != "del_1700000000_12345678" || u.Email != "del_1700000000_a@b.com" {
		t.Fatalf("credenciales no liberadas: dni=%q email=%q", u.DNI, u.Email)
	}
	if u.Phone != "" {
		t.Fatalf("telefono vacio no debe prefijarse: %q", u.Phone)
	}
	if !strings.HasSuffix(u.Name, " (Eliminado)") {
		t.Fatalf("nombre = %q", u.Name)
	}
}
