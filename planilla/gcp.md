# Google Cloud Platform — texto para la planilla

**Modificación:** Se agrega "Indique cuenta T1" siempre visible y no obligatoria, como en la planilla. Se corrige "Consola de administración".

**Detalle:**
- Variable `u_gcp_indique_cuenta_t1` ("Indique cuenta T1"): queda siempre visible y no obligatoria. Solo es obligatoria en Eliminación + Colaborador interno + "¿Posee cuenta T1?" = Sí.
- UI Policy "Mostrar - Indique cuenta T1" renombrada a "Obligatorio - Indique cuenta T1 (Eliminación con T1)": ya no oculta el campo (visible = ignorar), solo lo hace obligatorio.
- Client scripts "onChange - Limpiar campos - Acción" (GCP_LIMPIAR_ACCION) y "onChange - Limpiar campos - Colaborador" (GCP_LIMPIAR_COLAB): ya no borran "Indique cuenta T1".
- Client script "onChange - Limpiar campos - Posee T1" (GCP_LIMPIAR_POSEE): inactivado (solo limpiaba "Indique cuenta T1").
- Variable `u_gcp_rol_consola_admin`: texto "Consola Admnistración" → "Consola de administración".
- Flow (Flujo I - Google_Cloud_Platform) sin cambios: solo usa Acción requerida y célula; la rama "Otorgar o Modificar Acceso" ya considera Creación y Modificación.
