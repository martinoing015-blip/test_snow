# Microsoft Azure — texto para la planilla

**Modificación:** Se deja el formulario como la planilla: se agrega "Indique cuenta T1" y se quitan los campos que ya no se usan.

**Detalle:**
- Variables inactivadas: `u_ms_az_colaborador_interno_o_proveedor`, `u_ms_az_requiere_rol_administrativo` y `u_ms_az_proyecto`, junto con la UI Policy "Mostrar - Colaborador interno o proveedor".
- Variable `u_ms_az_cuenta_t1` ("Indique cuenta T1"): activada, siempre visible y obligatoria.
- UI Policies: "Mostrar - Otorgar/Modificar Acceso" pasa a "Mostrar - Vigencia". Ella y "Mostrar - Caducidad vigencia" borran el valor al ocultarse. "Mostrar - Obligatoriedad ¿…célula?" pasa a "Obligatorio - ¿Esta solicitud está asociada a una célula?". Solo lectura queda al final.
- Client script "onChange - Limpiar campos - Acción" (AZ_LIMPIAR_ACCION): solo limpia Vigencia y Caducidad.
- Opciones "Eliminar Acceso", "Definida" e "Indefinida": se ven tal cual, sin la traducción global ("Eliminar" / "Temporal" / "Permanente").
- Flow (Flujo I - Microsoft_Azure): sin cambios.
