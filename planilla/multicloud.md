# Solicitud Masiva Entorno Multicloud — texto planilla

## Modificación
- "¿Requiere rol administrativo?" queda como en Remedy: Si / No en Azure, AWS y OCI; Consola Administración / Dominio de datos en GCP (antes Si / No para todos).
- Con Si (o Consola Administración en GCP) se pide "¿Posee cuenta T1?" y, con Si, "Indique cuenta T1". Con Dominio de datos se pide "Indique nombre de matriz GCP" obligatorio.
- Modificación muestra los mismos campos que Creación (antes solo se veían Cantidad, Descripción y Proyecto).
- Eliminación: se agrega "Indique rol a eliminar" obligatorio; con Azure, AWS y OCI pide además "¿Posee cuenta T1?". No pide rol administrativo ni Vigencia, como en Remedy.
- "Caducidad Vigencia" ahora permite elegir fecha y hora, como en Remedy.
- Al cambiar Acción, Ambiente o Rol se limpian los campos que dependen de ellos.
- El link de la descripción dice "Gestión de Cuenta con Alto Privilegio T1, T2", como en Remedy.
- Todos los campos quedan en solo lectura en el RITM.
- El Flow no cambia.

## Detalle
Variables creadas: u_sol_mas_ent_mcld_requiere_rol_admin_gcp (Cuadro de selección: consola_administracion "Consola Administración", dominio_datos "Dominio de datos"), u_sol_mas_ent_mcld_rol_eliminar (Texto de una línea).
Variables ajustadas: u_sol_mas_ent_mcld_caducidad_vigencia (tipo Fecha → Fecha/hora); u_sol_mas_ent_mcld_matriz_gcp (reactivada, texto "Indique nombre de matriz GCP"); u_sol_mas_ent_mcld_requiere_rol_admin (se mantiene Si / No, solo para Azure / AWS / OCI). Variables renumeradas de 100 en 100 (100 a 1400); set "Conjunto de celulas 2" en 1500 (io_set_item del ítem, sin tocar el set).
Variables inactivas: u_sol_mas_ent_mcld_matriz_azure, u_sol_mas_ent_mcld_matriz_aws, u_sol_mas_ent_mcld_matriz_oci (siguen inactivas; Remedy no las pide).
Políticas renombradas: "Mostrar -  Obligatoriedad Seleccione Célula" → "Obligatorio - ¿Esta solicitud está asociada a una célula?"; "Mostrar - Google Cloud Platform" → "Mostrar - Indique nombre de matriz GCP" (reactivada, condición GCP + Dominio de datos); "Mostrar - Microsoft Azure / Amazon Web Service / Oracle Cloud Infrastructure" → "Mostrar - Indique nombre de matriz de Azure / AWS / OCI" (inactivas).
Políticas creadas: Mostrar - ¿Requiere rol administrativo? (GCP) / Mostrar - Indique rol a eliminar.
Políticas ajustadas (condición): "Mostrar - Seleccione ambiente Cloud" (Creación, Modificación o Eliminación); "Mostrar - ¿Requiere rol administrativo?" (Creación o Modificación + Azure / AWS / OCI); "Mostrar - ¿Posee cuenta T1?" e "Indique cuenta T1" (rol Si o rol GCP Consola Administración, o Eliminación con Azure / AWS / OCI); "Mostrar - Vigencia" y "Mostrar - Caducidad Vigencia" (Creación o Modificación). Políticas renumeradas de 100 en 100.
"Solo lectura": orden al final (1200); agrega requiere_rol_admin_gcp, rol_eliminar y matriz_gcp; se quitan las acciones sobre matriz_azure / aws / oci.
Client scripts creados: onChange - Limpiar campos - Rol admin GCP (SMMC_LIMPIAR_ROL_GCP).
Client scripts ajustados: onChange - Limpiar campos - Acción / Ambiente / Rol admin (campos a limpiar actualizados).
Descripción: link "Gestión de Cuenta con Alto Privilegio T1, T2" (texto base y traducción es).
Flow (Flujo I - Solicitud_Masiva_Entorno_Multicloud): sin cambios.
