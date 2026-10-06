# Backup — Homologación de catálogos BCH Ciber con Remedy

Contexto para continuar en un chat nuevo. Proyecto BCH Ciberseguridad (Banco de Chile), instancia de desarrollo `bancochileciberdev`. Objetivo: dejar los ítems de catálogo de ServiceNow iguales a los formularios de Remedy. El seguimiento se lleva en una planilla (Elemento de catálogo / Vínculo / Estado / Responsable / Modificación), repartida entre Martín, Kathy y Estefi. Go Live: 02-10-2026 (**confirmar si se movió y qué update sets se promovieron**).

Última actualización: 06-10-2026.

---

## 1. Forma de trabajo (respetar siempre)

- Todo se hace con **Background Scripts** (scope Global, update set de trabajo seleccionado, **"Record for rollback?" marcado**).
- Cada script trae `DRY_RUN = true` primero (solo lectura) y después `false`.
- En cada script o paso indicar **con qué cuenta** se ejecuta (sesión admin o usuario suplantado) y **si es solo lectura o modifica datos**.
- **NUNCA modificar los conjuntos de variables (variable sets)**: afectan a todos los catálogos que los usan. Los cambios se hacen a nivel del ítem (policies del ítem, client scripts del ítem, orden del vínculo `io_set_item` del ítem).
- No cambiar **values** de opciones existentes (los leen Flows y policies); solo el texto.
- Variables nuevas con el **prefijo del catálogo**.
- Al terminar cada catálogo, entregar texto para la planilla: **Modificación** (corta) y **Detalle**.
- Probar siempre en **ventana de incógnito nueva** (el portal cachea).

## 2. Aprendizajes técnicos clave

- **Traducciones**: el portal está en español y muestra la traducción, no el texto base.
  - Campos traducibles largos (help_text, question_text, description, short_description): tabla `sys_translated_text` (tablename + documentkey + fieldname + language=es). Al cambiar el texto base, actualizar también la traducción.
  - Opciones de `question_choice.text`: se traducen por **texto** en la tabla compartida `sys_translated` (name=question_choice, element=text, value=texto base, label=traducción). Es global: afecta a todo catálogo con ese mismo texto.
- **Traducción global Definida→Temporal / Indefinida→Permanente** (sys_translated, creadas por Kathy el 25-05-2026, sys_ids `8c8bb1ca3bcd83502815757e53e45a75` y `8f8b35ca3bcd83502815757e53e45a0e`). Afecta ~26 variables de ~17 catálogos. **No se borró.** Arreglo solo por ítem: agregar carácter invisible `​` al final del texto de la opción ("Definida​"). El espacio normal NO sirve (ServiceNow lo ignora en la búsqueda de traducción).
  - Riesgo: si alguien edita el texto a mano se pierde el `​` y vuelve "Temporal" sin aviso; puede ensuciar exportaciones/búsquedas. Decisión de fondo pendiente con Kathy.
- **Texto de ayuda siempre visible**: `help_text` + `show_help=true` + `show_help_on_load=true` + traducción es en `sys_translated_text`.
- **Flows (Flow Designer)**: los `values` de `sys_hub_action_instance_v2` / `sys_hub_flow_logic_instance_v2` vienen comprimidos; se leen con `GlideCompressionUtil.expandToString(GlideStringUtil.base64DecodeAsBytes(values))`. Útil para verificar si un Flow usa una variable antes de tocarla.
- **Condiciones de policy**: formato `IO:<sys_id variable>=<value>^...^EQ`. La acción de policy apunta con `catalog_variable = 'IO:<sys_id>'`; "Borrar valor" = `value_action='clearValue'`.
- Dos policies con "Invertir si es falso" sobre la misma variable chocan (una oculta y borra mientras la otra muestra).
- Las policies corren después del onLoad: un client script que maneja variables también cubiertas por policies puede ser pisado.
- **Variable tipo Personalizada (14) con widget**: guarda valor si el widget hace `g_form.setValue(field.name, ...)`. Su obligatoriedad en el portal da mensaje vacío → mejor validar por onSubmit. El widget puede ignorar readonly (probar en RITM).
- **Requested For (31)** se autollena con el usuario conectado; para que parta vacía hace falta onLoad con `clearValue`. Si la variable es del ítem (no de un set), es más simple quitar el default `javascript:gs.getUserID()`.
- **Tipos de variable**: 9 = Fecha, 10 = Fecha/hora.
- **Reordenar variables**: al renumerar, recolocar también el `io_set_item.order` del ítem para que el set quede en la misma posición relativa (no toca el set).
- `addQuery('question.cat_item', ...)` sobre question_choice NO funciona (campo inválido); filtrar por variable.
- Scripts client callable (GlideAjax): si con usuario suplantado no responden, puede faltar ACL de client callable script include.

## 3. Componentes reutilizables creados

- **Script Include `BCHDatosUsuarioAjax`** (client callable): `getDatos(sysparm_user)` → JSON { rut (employee_number), dominio (user_name sin @…), depto (department) }. Reutilizable en otros catálogos.
  - ⚠️ **Riesgo de seguridad**: responde para cualquier `sysparm_user`; cualquier usuario logueado puede consultar el RUT de otro desde la consola. Opciones: responder solo si el consultado es el usuario conectado o si quien llama tiene rol; o validar catálogo de origen.
- **Script Include `BCHSolMasCtasAplicacionAjax`** (client callable): mapa opción Remedy → aplicación de `u_plataforma_generica` (tipo 1) para llenar `aplicacion` en Solicitud Masiva.
- **Widget `ciber_custom_number_spinner_1_25`** ("Ciber - Custom Number Spinner (1-25)", sys_id `3b0202d33b2bcb506977352eb3e45a94`): clon del de Estefi con mínimo 1 y asterisco fijo. Pendiente: soporte de solo lectura (ng-disabled) — probar en RITM con policy Solo lectura.
- Mapeo `sys_user`: RUT = `employee_number`, usuario de dominio = `user_name` (cortar desde @), unidad = `department`.

## 4. Estado por catálogo

### 4.1 Acceso a Carpetas Compartidas (`u_acc_cpt_com_`)
- Se entregaron client scripts onChange para limpiar Privilegios / Vigencia / Caducidad al cambiar Acción y Tipo de acción. **Confirmar si se aplicaron.**

### 4.2 Filtro en Firewall (`u_filt_fw_`)
- Script onChange de limpieza en Tipo de Solicitud (**confirmar si se aplicó**).
- Policy de Eliminación de Reglas: ocultar `solicitud_regla`, `proposito_regla`, `confirma_cruce` con Obligatorio=Falso (ajustado a mano).
- Propuesta (no confirmada): duplicar `confirma_cruce` como `confirma_cruce_hab` para Habilitación de Regla.
- En la planilla dice "no encontrado en Remedy" → sí se trabajó con capturas de Remedy; **actualizar la fila**.

### 4.3 Remedy (`fe0327841b3f765058f65425604bcb75`, prefijo `u_rmy_`) — TERMINADO
- Crear: "Añadir privilegios de acceso" (etiqueta + 6 casillas + onSubmit al menos uno), "Nuevo servicio en Centro de Asistencia", "Informe de Smart Reporting (Crear)", "Crear cuenta de Servicio".
- Modificar: "Modificar grupo de soporte", "Añadir privilegios de acceso (Modificar)", "Modificar servicio en Centro de Asistencia". Policy antigua de Smart Reporting quedó solo con su ámbito.
- Scripts "onChange - Limpiar campos" (Tipo de actividad y ámbitos). Solo lectura completo. Orden de 100 en 100.

### 4.4 Revisión/Deshabilitación de Agentes de Ciberseguridad (`53b9bfe51bd772d058f65425604bcb46`, `u_rev_desh_agnt_cibr_`) — TERMINADO (falta poner estado en planilla)
- "Seleccionar agente" pasa a casillas en: Servidor On Premise (3), Cloud solo IaaS Linux/Windows (5), Estación MAC (3) y Windows (5). Inactivadas `seleccionar_agente`, `_2`, `_3`, `_4`.
- Nueva `version_linux_cloud`, policies "Mostrar - Cloud (solo IaaS) - Linux" y "- Agentes". Ajustadas "Mostrar - Linux/Windows".
- onSubmit de validación (On premise, Cloud, Estación). onChange de limpieza (Tipo de equipo, Ambiente, SO Servidor, SO Estación). Solo lectura completo. Variables y policies de 100 en 100.
- ⚠️ **Pendiente prioridad alta**: revisar en el Flow (paso Create Catalog Task) que la SCTASK muestre las casillas nuevas. Si la lista de variables es explícita, el resolutor verá solo las antiguas inactivas vacías.

### 4.5 Solicitud de Paw (`4bb5c56f1b633250d4f1a756624bcb70`, `u_sol_paw_`) — TERMINADO
- Textos enriquecidos reemplazados por texto de ayuda siempre visible en `paw_para_creador` y `rut_pasaporte_usuario` (con traducción es). Inactivados los textos enriquecidos y su policy.

### 4.6 Solicitud Masiva de Cuentas de Usuario (`412324ab1ba7325058f65425604bcbd3`, `u_sol_mas_ctas_usr_`) — TERMINADO
- "Tipo de acción requerido" → "Que desea realizar?" (Creación nueva value `creacion`; Modificación / Eliminación mantienen values).
- Nuevas: `tipo_aplicativo`, `elemento_aplicativo` (246 opciones Remedy), `elemento_plataforma` (40), `privilegio_requerido` (Administracion/Lectura/Operador, solo Ciber). `aplicacion` (del set) oculta en el ítem y llenada por GlideAjax.
- Cantidad de Usuarios → widget clonado 1-25, no obligatoria a nivel variable, validada por onSubmit.
- Policy "Obligatorio - ¿Esta solicitud está asociada a una célula?" (del ítem). Descripción no obligatoria. "Ni" → "No" en Proyecto.
- onChange de limpieza (Tipo de aplicativo, Que desea realizar, Proyecto). Solo lectura.
- Flow verificado: no usa tipo de acción; aprobadores = manager.
- Pendiente BCH: 27 aplicativos y 9 plataformas sin equivalente en `u_plataforma_generica`; pregunta célula vs "proyecto ágil".

### 4.7 Gestión de Cuenta en Servidor (Cyberark) (`ca8bf7bc2bd14bd0d8e0fc3c3291bf05`, `u_gest_cta_srv_cybr_`, Flujo K exclusivo, marcador `CYBR_`) — EN CURSO
- Hecho: descripción y descripción corta como Remedy (con traducciones); "Petición para" (Requested For) + RUT / Usuario de Dominio / Unidad autocompletados (BCHDatosUsuarioAjax); 5 Vigencias con Definida/Indefinida (carácter invisible); camino Modificar Acceso → Otorgar: `indicar_servidores_4`, `vigencia_4`, `caducidad_vigencia_4`, policy de Caducidad, creación en máquina = `cont_2` sin depender del SO, `cont_3` inactiva; variables de 100 en 100 y sets recolocados.
- **Pendientes**:
  - "Petición para" vacía (hoy sigue con default `javascript:gs.getUserID()`). Si es del ítem: quitar default; si viene de set: onLoad con clearValue.
  - Revisar client script "Mapeo Dinámico - Acción Requerida" (maneja 12 variables del camino Crear que no están en policies; posible choque con policies).
  - Texto de ayuda de `nombre_cuenta`: base y traducción es dicen cosas distintas; confirmar con Remedy.
  - Posible bug en policy "Mostrar - Seleccione Sistema Operativo - Windows" (2ª rama usa `so_1=unix` con Modificar Privilegios).

### 4.8 Gestión de Cuentas de Servicio (`f4bb3fbc2bd14bd0d8e0fc3c3291bf18`, `u_gest_ctas_svc_`, Flujo K - Gestion_Cuentas_Servicio, marcador `CTASVC_`) — EN CURSO
- Arquitectura: client scripts en cascada (Nivel 1 Master apaga todo; Nivel 2/3/4 enrutadores) + 19 policies de detalle. Cada cambio debe pasar por el script de diagnóstico.
- Hecho: "Seleccione Empresa" (`seleccione_empresa`, Banco de Chile / Socofin, orden 50, obligatoria, en Solo lectura).
- Dry run OK, **confirmar corrida en false**: inactivar `clase_cta_unix` (Flow no la usa); 8 Vigencias a Definida/Indefinida con carácter invisible (opcional `CAMBIAR_AYUDA` con texto de Remedy).
- **Pendientes**:
  - Descripción corta base dice "Gestión de Casillas de Correo Genérica".
  - Faltan en Solo lectura: `uni_res_apli`, `nom_res_cu_bd`.
  - Set "Campos editables en consola" en orden 10000 (en medio del formulario).
  - "Seleccione recurso nube" en Crear dice "API" (en Modificar "AWS"): confirmar con Remedy.
  - Ayuda de `usr_dominio_responsable_bd` menciona "Unix".
  - Campos responsables Unix no se autollenan (usar BCHDatosUsuarioAjax).
  - Seguir comparando con Remedy por camino (Crear Windows/BD/Aplicativos, Modificar, Eliminar).

### 4.9 Solicitud Masiva Entorno Multicloud (`31c840631be3325058f65425604bcb53`, `u_sol_mas_ent_mcld_`) — EN CURSO
- Caducidad Vigencia: en Remedy es fecha y hora; la nuestra era solo fecha. Script entregado para pasar `u_sol_mas_ent_mcld_caducidad_vigencia` a Fecha/hora (tipo 10) → **confirmar si se corrió en false** (ver `scripts/multicloud_caducidad_fecha_hora.js`).
- En AWS y GCP, Caducidad Vigencia también es solo fecha: si en Remedy tienen hora, aplicar el mismo cambio.
- Caducidad Vigencia ya se ve con hora en el portal (cambio aplicado).
- Diferencias con Remedy (Creación, GCP), 06-10 (ojo: en las capturas Remedy es el portal con "Enviar petición" naranjo; ServiceNow muestra "-- Ninguno --" y el panel "Información obligatoria"):
  - "¿Requiere rol administrativo?": Remedy = Consola Administración / Dominio de datos; ServiceNow = Si / No.
  - Remedy: Consola Administración → ¿Posee cuenta T1? (Si → Indique cuenta T1). Dominio de datos → "Indique nombre de matriz GCP".
  - En ServiceNow `matriz_azure/aws/oci/gcp` estaban inactivas con policies de condición rota (`accion=seleccione_ambiente_cloud`).
  - Link de la descripción: Remedy "Alto Privilegio T1, T2" vs ServiceNow "T1".
  - Pregunta final: Remedy "¿…asociada a un proyecto ágil?" vs ServiceNow "¿…asociada a una célula?" (viene del set; misma duda BCH que 4.6).
  - Remedy escribe "Consola Admnistración" (typo); en ServiceNow va bien escrito.
- Corrección 1 aplicada (`scripts/multicloud_rol_admin_como_remedy.js`): opciones Consola/Dominio, matrices, orden, link T1, T2.
- Remedy confirma que **solo GCP** usa Consola Administración / Dominio de datos; Azure / AWS / OCI siguen con Si / No, y solo GCP pide matriz.
- Corrección 2 (`scripts/multicloud_rol_admin_gcp.js`, **pendiente correr**): `requiere_rol_admin` vuelve a Si/No (Azure/AWS/OCI); nueva `requiere_rol_admin_gcp` (Consola/Dominio, opciones movidas) con policy "Mostrar - ¿Requiere rol administrativo? (GCP)"; Posee T1 con rol=si o rol_gcp=consola; matriz GCP con rol_gcp=dominio; matrices Azure/AWS/OCI inactivas de nuevo; nuevo onChange `SMMC_LIMPIAR_ROL_GCP`.
- Se ignora la línea "acuerdo de atención de 7 días hábiles" de Remedy (decisión del usuario).
- Marcador de client scripts de este catálogo: `SMMC_`.
- Diagnóstico solo lectura: `scripts/diag_multicloud_31c84063.js`.
- Esperando capturas de Remedy: Modificación y Eliminación.

### 4.10 Catálogo `6533bf811b140750d4f1a756624bcb94` — POR ANALIZAR
- Se entregó el script de diagnóstico con este ITEM_ID. **Falta el output** y confirmar qué catálogo es.

## 5. Pendientes generales
- Aclarar Go Live (02-10-2026): ¿se movió? ¿qué update sets se promovieron? Riesgo de arrastrar cambios a medias de 4.7/4.8.
- Script de verificación solo lectura para 4.1, 4.2 y 4.8 (client scripts activos, estado de `clase_cta_unix`, texto de opciones de Vigencia).
- Seguridad `BCHDatosUsuarioAjax` (ver sección 3).
- Coordinar con Kathy la traducción global Definida/Temporal (afecta ~17 catálogos).
- Documento de dudas BCH: aplicativos/plataformas sin equivalente, célula vs proyecto ágil, "Seleccione recurso nube" API vs AWS, ayuda de `nombre_cuenta`.
- Planilla: Revisión/Deshabilitación de Agentes sin estado; Filtro en Firewall marcar como trabajado.

### Orden sugerido
1. Aclarar Go Live / update sets.
2. Script de verificación (4.1, 4.2, 4.8).
3. Flow de Agentes → SCTASK con casillas.
4. Cerrar 4.7 Cyberark.
5. Pendientes chicos de 4.8.
6. Comparación restante 4.8 vs Remedy por camino.
7. Seguridad BCHDatosUsuarioAjax + decisión Definida/Temporal con Kathy.
8. Planilla.

## 6. Script de diagnóstico reutilizable (solo lectura)
Cambiar `ITEM_ID`. Muestra variables (tipo, obligatoria, ayuda + traducción, opciones, marca `​`), sets con `io_set_item.order`, policies con condiciones IO: traducidas, client scripts (código; `PRINT_CODE=false` para acortar), chequeo de Solo lectura y variables usadas por el Flow. **Pendiente guardarlo en `scripts/`** (si no se tiene a mano, regenerarlo: "script de diagnóstico completo de catálogo con traducción de condiciones IO:").

---

## 7. Convenciones de construcción (estándar a seguir)

### Variables
- Prefijo del catálogo en todas (ej. `u_rmy_`, `u_rev_desh_agnt_cibr_`, `u_sol_mas_ctas_usr_`, `u_gest_cta_srv_cybr_`, `u_gest_ctas_svc_`, `u_sol_mas_ent_mcld_`).
- En catálogos nuevos se usa el prefijo que ya tengan sus variables; si no tienen, **preguntar antes de crear la primera**.
- Nombre descriptivo tras el prefijo; si se repite por camino, sufijo: `vigencia_4`, `nombre_reporte_crear`, `agente_onprem_crowdstrike`, `agente_est_win_trellix`.
- Orden de 100 en 100, misma secuencia que Remedy. Sets recolocados vía `io_set_item.order` del ítem (sin tocar el set).
- Values de opciones en minúscula con guion bajo (`definida`, `banco_de_chile`). Nunca cambiar un value existente, solo el texto.
- Variables antiguas se inactivan, no se borran.
- Toda variable nueva va a "Solo lectura" (excepto etiquetas y textos enriquecidos).

### UI Policies (nombres)
- `Mostrar - <qué/condición>` (ej. `Mostrar - Añadir privilegios de acceso (Modificar)`, `Mostrar - Cloud (solo IaaS) - Agentes`).
- `Ocultar - <qué>` (ej. `Ocultar - Aplicacion (se llena desde Elemento)`).
- `Obligatorio - <qué>` (ej. `Obligatorio - ¿Esta solicitud está asociada a una célula?`).
- `Solo lectura`: una por ítem, aplica solo a RITM y tareas (catálogo desmarcado).
- Configuración estándar: Al cargar + Invertir si es falso; acciones con Visible / Obligatorio / Borrar valor según corresponda.
- Orden de 100 en 100, Solo lectura al final.

### Client scripts (nombres)
- `onChange - Limpiar campos - <variable que dispara>`
- `onSubmit - Validar <qué valida>`
- `onLoad - <qué hace>`
- `onChange - Llenar <campo> desde <origen>`

### Marcadores en client scripts
- Comentario dentro del código que identifica al script: `// <ABREVIATURA_CATALOGO>_<ACCION>`, en mayúscula.
- Ejemplos: `// RMY_LIMPIAR_TIPO`, `// SOLMAS_COPIA_APLICATIVO`, `// CYBR_PETICION_VACIA`, `// CTASVC_AUTOLLENAR_UNIX`.
- Sirve para: (1) que el Background Script busque `script CONTAINS <marcador>` antes de crear y así no duplicar; (2) ubicarlo aunque le cambien el nombre; (3) saber que salió de la homologación y de qué catálogo.

### Forma de trabajo
- Background Script: `DRY_RUN = true` → revisar output → `false`. Scope Global, update set seleccionado, "Record for rollback?" marcado.
- Indicar cuenta (admin / usuario suplantado) y si es solo lectura o modifica datos.
- Nunca tocar variable sets; todo a nivel del ítem.
- Antes de inactivar/cambiar, revisar el Flow descomprimido.
- Al cambiar textos, actualizar también la traducción al español.
- Al cerrar cada catálogo: Modificación + Detalle técnico (nombrando variables, políticas y scripts creados, ajustados o inactivados) para la planilla.
- En scripts de prueba que creen RITM, usar el usuario sys_id `43a9c5093bc703106977352eb3e45ab0` como previsto y para variables de usuario.
