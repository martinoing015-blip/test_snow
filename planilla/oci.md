# Oracle Cloud Infrastructure — texto para la planilla

**Modificación:** Se deja el formulario como la planilla V2: se elimina Proyecto y las preguntas condicionales que ya no se usan; "Indique cuenta T1" queda siempre visible y obligatoria.

**Detalle:**
- Variables inactivadas: `oci_colaborador_interno_o_proveedor`, `oci_indique_rol_a_eliminar`, `oci_requiere_rol_administrativo`, `oci_posee_cuenta_t1` y `oci_proyecto`.
- UI Policies inactivadas: "Mostrar - Requiere rol admin", "Mostrar - Colaborador interno o proveedor", "Mostrar - Indique cuenta T1", "Mostrar - Indique rol a eliminar" y "Mostrar - Posee cuenta T1".
- Variable `oci_cuenta_t1` ("Indique cuenta T1"): siempre visible y obligatoria.
- UI Policies "Mostrar - Vigencia" y "Mostrar - Caducidad vigencia" (condición: Otorgar/Modificar Acceso + Definida): borran el valor al ocultarse. "Mostrar - Obligatoriedad Seleccione Célula" pasa a "Obligatorio - ¿Esta solicitud está asociada a una célula?". Solo lectura queda al final.
- Client script "onChange - Limpiar campos - Acción" (OCI_LIMPIAR_ACCION): solo limpia Vigencia y Caducidad.
- Opciones "Eliminar Acceso", "Definida" e "Indefinida": se ven tal cual, sin la traducción global ("Eliminar" / "Temporal" / "Permanente").
- Flow (Flujo I - Oracle_Cloud_Infrastructure): sin cambios.
