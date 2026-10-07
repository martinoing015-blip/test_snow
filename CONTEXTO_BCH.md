# Backup — Homologación de catálogos BCH Ciber con Remedy

Contexto para continuar en un chat nuevo. Proyecto BCH Ciberseguridad (Banco de Chile), instancia de desarrollo `bancochileciberdev`. Objetivo: dejar los ítems de catálogo de ServiceNow iguales a los formularios de Remedy. El seguimiento se lleva en una planilla (Elemento de catálogo / Vínculo / Estado / Responsable / Modificación), repartida entre Martín, Kathy y Estefi. Go Live: 02-10-2026 (**confirmar si se movió y qué update sets se promovieron**).

Última actualización: 06-10-2026 (tarde).

**Para una sesión nueva de IA:** leer este archivo completo, después `git log --oneline -20` en la rama `claude/test-0wf3rv`. Los scripts están en `scripts/` (índice en la sección 8) y los textos para la planilla en `planilla/`. El usuario corre todo a mano en ServiceNow y pega el output en el chat; la IA no tiene acceso a la instancia. El usuario escribe informal (chileno), con respuestas cortas y directas.

---

## 1. Forma de trabajo (respetar siempre)

- Todo se hace con **Background Scripts** (scope Global, update set de trabajo seleccionado, **"Record for rollback?" marcado**).
- Cada script trae `DRY_RUN = true` primero (solo lectura) y después `false`.
- En cada script o paso indicar **con qué cuenta** se ejecuta (sesión admin o usuario suplantado) y **si es solo lectura o modifica datos**.
- **NUNCA modificar los conjuntos de variables (variable sets)**: afectan a todos los catálogos que los usan. Los cambios se hacen a nivel del ítem (policies del ítem, client scripts del ítem, orden del vínculo `io_set_item` del ítem).
- **Texto enriquecido de Remedy → texto de ayuda siempre visible en la variable que corresponde** (help_text + show_help + show_help_on_load + traducción es), nunca como etiqueta (decisión del usuario 07-10).
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
- **Referencia a sys_user en el portal**: siempre muestra el nombre (display value) en el campo; `ref_ac_columns` / `ref_ac_display_value=false` solo agregan columnas a la lista. Para que quede el username: variable de texto + GlideAjax.
- `addQuery('question.cat_item', ...)` sobre question_choice NO funciona (campo inválido); filtrar por variable.
- Scripts client callable (GlideAjax): si con usuario suplantado no responden, puede faltar ACL de client callable script include.
- **"-- Ninguno --" en Opción múltiple (3)**: si se quita, el portal marca sola la primera opción. Para que parta vacía: onLoad con `g_form.clearValue(...)` que corra **solo en catálogo** (applies_catalog=true, RITM y tarea en false; si no, borra lo elegido en el RITM).
- El mensaje `Issuing query on invalid record to get value of element name (GlideElementTranslatedText)` en el output es un aviso inofensivo.
- Al descomprimir `values` de Flows en todas las instancias, descomprimir solo los que empiezan con `H4sI` (gzip base64); si no, Java imprime un `EOFException` largo por cada registro y el output se vuelve inmanejable.
- **Renombrar un catálogo**: Flow, trigger, policies, client scripts y el MAP de Wo Types van por sys_id y no se rompen. Se rompe lo que compare el nombre como texto (BR, notificaciones, SLA, reportes, condiciones de Flow, integraciones). El portal muestra la traducción es del nombre (`sys_translated_text`, fieldname `name`): actualizarla también. Los RITM antiguos conservan el nombre viejo.

## 3. Componentes reutilizables creados

- **Script Include `BCHDatosUsuarioAjax`** (client callable): `getDatos(sysparm_user)` → JSON { rut (employee_number), dominio (user_name sin @…), depto (department) }. Reutilizable en otros catálogos.
  - ⚠️ **Riesgo de seguridad**: responde para cualquier `sysparm_user`; cualquier usuario logueado puede consultar el RUT de otro desde la consola. Opciones: responder solo si el consultado es el usuario conectado o si quien llama tiene rol; o validar catálogo de origen.
- **Script Include `BCHSolMasCtasAplicacionAjax`** (client callable): mapa opción Remedy → aplicación de `u_plataforma_generica` (tipo 1) para llenar `aplicacion` en Solicitud Masiva.
- **Widget `ciber_custom_number_spinner_1_25`** ("Ciber - Custom Number Spinner (1-25)", sys_id `3b0202d33b2bcb506977352eb3e45a94`): clon del de Estefi con mínimo 1 y asterisco fijo. Pendiente: soporte de solo lectura (ng-disabled) — probar en RITM con policy Solo lectura.
- **Script Include `BCHUsuarioPorDominioAjax`** (client callable, 07-10): `getDatos(sysparm_user_name)` → JSON { encontrados, rut, nombre, user_name }. Mismo riesgo de seguridad que el anterior.
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

### 4.9 Solicitud Masiva Entorno Multicloud (`31c840631be3325058f65425604bcb53`, `u_sol_mas_ent_mcld_`) — EN CURSO (falta Flow)
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
- Flow (Flujo I, publicado, **compartido** con catálogos AWS / GCP / Azure / OCI): solo usa `accion_requerida` y la célula; no tiene paso de tarea con lista de variables.
  - ⚠️ Rama "Otorgar o Modificar Acceso" (paso 8) compara nuestra acción solo con Creación → **Modificación no entra a ninguna rama**. Agregar OR `u_sol_mas_ent_mcld_accion_requerida = Modificación`.
  - Rama "Eliminar Acceso": condición 6 sobre nuestra variable sin value → quitar.
  - Revisar paso 31 (también lee nuestra acción). Confirmar con Remedy que Modificación lleva la misma aprobación. Cambio manual en Flow Designer + publicar.
  - Decisión: los values de Acción **se quedan como están** (`otorgar_modificar_acceso` = Creación, `modificacion`, `eliminar_acceso`); se descartó pasarlos a `_acceso` porque obliga a tocar el Flow compartido y todo lo que lea el value.
  - Pruebas: `scripts/prueba_multicloud_crear_tickets.js` (6 casos) y `scripts/prueba_multicloud_revisar_tickets.js` (Flow, aprobaciones, WO; `APROBAR=true` aprueba pendientes). Tickets creados 06-10: #1 RITM0011087 … #6 RITM0011092 (REQ0011140–REQ0011145). Pendiente revisar.
  - Aprendizaje: el diagnóstico de Flow detecta qué variables se usan, pero no qué values se comparan; revisar las condiciones en Flow Designer cuando se agregan opciones.
- Texto planilla: `planilla/multicloud.md`.
- Diagnóstico solo lectura: `scripts/diag_multicloud_31c84063.js`.
- Corrección 2 aplicada (la policy "(GCP)" existe).
- Remedy, Modificación: mismo comportamiento que Creación (Ambiente Cloud → rol → T1/matriz, Vigencia, Caducidad). Script `scripts/multicloud_modificacion_como_creacion.js` (policies con accion=Creación O Modificación). **Pendiente correr.**
- Remedy, Eliminación: Ambiente → (Azure/AWS/OCI) ¿Posee cuenta T1? (Si → Indique cuenta T1) + "Indique rol a eliminar"; (GCP) solo "Indique rol a eliminar". Sin rol administrativo ni Vigencia. AWS asumido igual que Azure/OCI (sin captura).
- Script `scripts/multicloud_eliminacion.js`: nueva `rol_eliminar`, policy "Mostrar - Indique rol a eliminar", Posee/Cuenta T1 con condición agrupada (rol=si OR rol_gcp=consola OR Eliminación) ^ (Azure/AWS/OCI OR rol_gcp=consola). Dry run OK; **confirmar corrida en false y pruebas**.

### 4.10 Amazon Web Services (`6533bf811b140750d4f1a756624bcb94`, prefijo `u_aws_`, Flujo I - Amazon_Web_Services exclusivo, **en Borrador**) — EN CURSO
- Diagnóstico 07-10:
  - Está como GCP antes de la planilla: Acción Creación / Modificación / Eliminación (values `otorgar_modificar_acceso` / `modificacion` / `eliminar_acceso`), Colaborador/Proveedor, Rol admin, Posee T1, Indique cuenta T1, Rol a eliminar, Vigencia / Caducidad, Proyecto, Descripción detallada, célula.
  - Ya tiene `\u200B` en Sí y Vigencia; marcadores `AWS_LIMPIAR_*`.
  - Flow: acción (2 ramas) + célula.
  - La descripción dice "T1, T2".
- `scripts/aws_como_planilla.js` (**pendiente dry run; confirmar con la planilla de AWS**): igual que Azure/OCI. Acción en 2 opciones (modificacion inactiva), inactiva los campos que sobran y sus policies y onChange, cuenta T1 obligatoria, textos y orden.

### 4.11 Action "Llenar Wo Types" (genérica, 75 catálogos)
- Llena campos `u_wo_type_*` del RITM según un MAP por catálogo (no crea registro aparte).
- Los catálogos que homologamos usan solo `requested_for.*` → nuestros cambios de variables no la afectan.
- `scripts/diag_wo_types_variables.js` (06-10): los 25 paths `var.` / `ritm.` de otros catálogos existen y están activos (incluye `u_pg_campo_023`, que sí existe).
- Pendiente revisar con quien armó el MAP: campos asignados dos veces (gana el último): T1/T2 y Matrices `u_wo_type_15` (queda `name`), Excepción RBAC `u_wo_type_15` (queda `manager.vip`) y `u_wo_type_06` (queda `title`), REDEC `u_wo_type_14` (queda `u_organizacion`).
- Al inactivar o renombrar variables de un catálogo, revisar si aparece con `var.` en el MAP.

### 4.12 Renombrar Usuario Interno/Externo (`a79c4c131b58cb1058f65425604bcb0d`, prefijo `u_ren_usr_int_ext_`, marcador `RENUSR_`) — EN CURSO
- Pedido del usuario: armar el **Rut** igual que en Cyberark (4.7), autollenado con `BCHDatosUsuarioAjax`. En la captura, "Rut" sale como desplegable con "-- Ninguno --" y otros 4 campos en solo lectura.
- Se entregó `scripts/diag_catalogo.js` con este ITEM_ID. **Falta el output** del diagnóstico para armar lo del Rut.
- Tipo de Cuenta (`u_ren_usr_int_ext_tipo_cuenta`, Opción múltiple, opciones `active_directory` / `local`, obligatoria por policy, no por variable): el usuario ya sacó el "-- Ninguno --". Para que no parta marcada la primera opción: `scripts/renusr_tipo_cuenta_sin_seleccion.js` crea "onLoad - Tipo de Cuenta sin selección" (marcador `RENUSR_TIPO_CUENTA_VACIA`, solo catálogo). Dry run OK; **confirmar corrida en false y prueba en incógnito** (si igual se marca, poner la limpieza con un `setTimeout` corto).

### 4.13 Habilitación de VPN para Colaborador Interno (`eeb095361b1336d0d4f1a756624bcb21`, Flujo C - Habilitacion_VPN_Colaborador_Interno) — CONSULTA
- El usuario quiere cambiarle el nombre. Base y traducción es: "Habilitación de VPN para Colaborador Interno" (en el MAP de Wo Types figura como "Gestión VPN para Colaborador Interno"). Falta definir el nombre nuevo.
- `scripts/buscar_uso_nombre_catalogo.js` (solo lectura) busca el nombre como texto en BR, Script Includes, notificaciones, SLA, reportes, client scripts, UI actions, propiedades, jobs, REST y Flows. La primera corrida se llenó de `EOFException` (ver aprendizajes); ya está corregido. **Volver a correrlo** y revisar cada uso antes de renombrar.

- 07-10 revisión: "Servicio reemplazado por nuevo servicio Gestión VPN para Colaborador interno / para Filiales y Proveedores. Se encuentra automatizado, por lo que cada uno de los inputs deben escribirse idéntico a la planilla (sharepoint)". `scripts/renombrar_catalogos_vpn.js` (por sys_id: `eeb09536…` Colaborador Interno, `e37a279e…` Filiales y Proveedores; **aplicado 07-10: ambos renombrados** (texto planilla en `planilla/vpn_renombre.md`); **⚠️ el ítem `d0bdf1ef3bac87502815757e53e45ab8` "Navegación Privilegiada" (Flujo C - Navegacion_privilegiada) tiene como nombre base "Habilitación de VPN para Colaborador Interno": error de copia, avisar**): busca usos del nombre como texto y renombra (name, short_description y traducción es) solo si no hay usos. **Pendiente: comparar variables con la planilla nueva (automatizado → inputs idénticos).**

### 4.14 Gestión de Cuenta con Alto Privilegio T0 (`1767b1041ba3761458f65425604bcb71`, prefijo `u_gest_cta_altpriv_t0_`, Flujo - Gestión_Cuenta_Alto_Privilegio) — POR COMPARAR CON REMEDY
- Diagnóstico 07-10: 5 variables del ítem, todas obligatorias y en el mismo orden para las 3 acciones: Acción requerida (`crear_cuenta` / `modificar_privilegios_de_cuenta` / `eliminar_cuenta`), Nombre de la cuenta, Vigencia (`indefinida` / `definida`), Caducidad de la cuenta (Fecha 9), Indicar justificación. Set "Campos editables en consola" con orden 10000, al final (aquí está bien).
- Policies: "Solo lectura" (orden 100, está completa) y "Mostrar -Caducidad de la cuenta" (orden 100, con vigencia=definida). Client script `onChange_caducidad_validar_90_dias`.
- Observaciones:
  - Vigencia se ve como Permanente / Temporal por la traducción global.
  - Ninguna variable depende de la Acción: Eliminar también pide Vigencia y Caducidad.
  - "Modificar privilegios de cuenta" no tiene traducción es (no afecta).
  - Las dos policies tienen orden 100 (Solo lectura debería ir al final) y al nombre "Mostrar -Caducidad" le falta un espacio.
  - El script de 90 días arma la fecha a mano asumiendo dd-mm-aaaa (falla si el formato del usuario es otro), tiene nombre fuera de convención y no tiene marcador.
- Remedy (planilla, Grupo Ciberseguridad / Cuentas TIER): Acción requerida (Crear cuenta / Modificar privilegios de cuenta / Eliminar cuenta), Nombre de la cuenta, Indicar justificación, todas obligatorias. **Vigencia (Indefinida / Definida) solo en Crear cuenta**; Definida → Caducidad de la cuenta (Fecha).
- `scripts/t0_vigencia_solo_crear.js` (aplicado 07-10; Vigencia ya se oculta): Vigencia deja de ser obligatoria en la variable, nueva policy "Mostrar - Vigencia" (accion=crear_cuenta, obligatoria, borrar valor), Caducidad con accion=crear_cuenta ^ vigencia=definida + borrar valor + nombre corregido, Solo lectura al final (300) y `\u200B` en Definida / Indefinida.
- Orden como Remedy: Acción → Vigencia → Caducidad → Nombre → Justificación: `scripts/t0_orden_variables.js` (**pendiente correr**).
- Pendiente: correr `scripts/diag_flow_catalogo.js` (¿el Flow usa la Vigencia? ¿lo comparten T1/T2?) y arreglar el formato de fecha del script de 90 días.

### 4.15 Gestión de Cuenta con Alto Privilegio T1 (`4adb81813bddc7902815757e53e45a22`, prefijo `u_gest_cta_altpriv_t1_`, Flujo C - Gestion_Cuenta_Alto_Privilegio_T1, exclusivo) — POR COMPARAR CON REMEDY
- Diagnóstico 07-10 (`scripts/diag_completo.js`):
  - Usuario Dominio (referencia sys_user, orden 70, texto con espacio al inicio) autollena Rut y Nombre completo (solo lectura).
  - Acción: crear_cuenta / habilitar_cuenta / modificar_cuenta / desvincular_dispositivo_mfa / eliminar_cuenta.
  - Crear y Modificar: acceso a servidores (Sí → Servidor(es)), ¿acceso a nubes?, texto enriquecido, Periodo de vigencia (`definido` / `indefinido`, en masculino, sin el problema Temporal) → Caducidad.
  - Habilitar, Modificar, Desvincular MFA y Eliminar tienen cada uno su "Indique usuario…".
  - Al final: Justificación, Proyecto (Sí/no, tipo 1) → nombre del proyecto.
- Flow: no usa variables del catálogo (sus "Si" son de aprobación). Llenar Wo Types en el MAP: solo `requested_for.*` → se pueden cambiar variables sin romperlo.
- Observaciones:
  - **Caducidad vigencia es Texto (6)**, debería ser Fecha o Fecha/hora (confirmar con Remedy).
  - Ninguna policy borra valor.
  - "Mostrar - Crear cuenta" aplica también a Modificar.
  - ¿Acceso a nubes? no despliega nada al elegir Sí.
  - Sí → "Si" por la traducción global.
  - El onChange de Rut usa GlideRecord en el cliente: puede fallar en el portal o por ACL con usuarios no admin. Mejor `BCHDatosUsuarioAjax` (no trae nombre completo: habría que agregarlo).
  - Orden 70/80/90/150/450 fuera de convención.
- Revisión (planilla de pruebas), 2 correcciones pedidas → `scripts/t1_usuario_dominio_y_caducidad.js` (**dry run OK 07-10, 0 RITM con valor; falta false y probar**):
  - Usuario Dominio: que en el input quede el username, no el nombre completo. Se hace con atributos `ref_auto_completer=AJAXTableCompleter,ref_ac_columns=user_name;name,ref_ac_columns_search=true,ref_ac_display_value=false`. Probar en el portal; si igual muestra el nombre, plan B: variable aparte o cambio de display.
  - Caducidad vigencia: Texto → Fecha (9).
- Planilla Remedy recibida 07-10. Orden: Usuario Dominio, RUT, Nombre completo (solo lectura), Acción. Crear y Modificar: (Modificar: Indique usuario) Requiere acceso a servidores (Sí → Servidor(es)), ¿Requerirá acceso a nubes? (Sí/No, sin hijo), "(Solo para registro interno)", Periodo de vigencia (Definido → Caducidad, Fecha). Habilitar y Desvincular MFA: Indique usuario + NOTA. Eliminar: Indique usuario. Justificación, Proyecto (Sí → nombre), Adjuntar archivo (no obligatorio).
- `scripts/t1_ajustes_planilla.js` (**dry run OK 07-10, falta false y probar**; el anterior ya se aplicó):
  - Usuario Dominio solo con username en la lista (`ref_ac_columns=user_name`) y sin espacio inicial. **Si el campo sigue mostrando el nombre al elegir, plan B: variable de texto + GlideAjax (la planilla dice texto de una línea).**
  - "Rut" → "RUT". Caducidad → Fecha. Borrar valor en las policies "Mostrar". "Mostrar - Crear o Modificar cuenta". Orden de 100 en 100.
- Resultado 07-10: en el portal la referencia **sigue mostrando el nombre** (los atributos `ref_ac_*` no cambian el display value de sys_user). Plan B → `scripts/t1_usuario_dominio_texto.js` (**dry run OK 07-10, 1 RITM antiguo con sys_id; falta false y probar**): Usuario Dominio pasa a Texto (6), nuevo Script Include client callable `BCHUsuarioPorDominioAjax.getDatos(sysparm_user_name)` (user_name exacto o "usuario@…") y el onChange se reescribe con GlideAjax (`onChange - Llenar RUT y Nombre desde Usuario Dominio`, marcador `T1_USUARIO_DOMINIO`). Mismo riesgo de seguridad que BCHDatosUsuarioAjax (devuelve RUT de cualquier usuario).
- No se toca: Proyecto es Sí/no (tipo 1; la planilla dice cuadro de selección, funciona igual). "Sí" se ve "Si" por la traducción global. RUT y Nombre no son obligatorios (la planilla dice Sí, pero son de solo lectura y autollenados).

### 4.16 Gestión de Cuenta con Alto Privilegio T2 (`c65920cf1b933ed058f65425604bcb62`) — EN CURSO
- Misma revisión que T1: Usuario Dominio con username en el campo y Caducidad como Fecha. Formulario igual al de T1 (Usuario Dominio referencia, Rut y Nombre completo de solo lectura, Acción, Justificación, Proyecto).
- Prefijo confirmado `u_gest_cta_altpriv_t2_`. Variables: usuario_dominio (ref), usuario_rut, usuario_nombre_completo (texto " Nombre completo" con espacio inicial), accion_requerida, indique_usuario_modificar, periodo_vigencia, caducidad_vigencia (Texto), descripcion_requerimiento, indique_usuario_habilitar (+ texto enriquecido), indique_usuario_eliminar, justificacion (una línea; en T1 es multilínea), proyecto (cuadro de selección), proyecto_nombre, adjuntar_archivo (inactiva). Orden 70/80/90/450 fuera de convención.
- `scripts/t2_usuario_dominio_y_caducidad.js` (**dry run OK 07-10, falta false**; reutiliza el Script Include ya creado por T1): busca las variables por texto (prefijo no confirmado), reutiliza `BCHUsuarioPorDominioAjax` (lo crea si no existe), Usuario Dominio → Texto, reescribe su onChange (marcador `T2_USUARIO_DOMINIO`) y Caducidad → Fecha.
- Pendiente: diagnóstico completo y planilla de T2 para el resto (orden, borrar valor, RUT).
- ⚠️ 07-10: el usuario cree haber apuntado el **previsto (requested_for)** del Flow a Usuario Dominio. Si es así, al pasar la variable a Texto el previsto queda mal (aprobaciones y Wo Types dependen de él). Revisado con `scripts/verificar_usuario_dominio_flow.js`: **ni el Flow de T1 ni el de T2 usan la variable**, y no hay BR, Script Includes ni notificaciones que la usen (solo nuestro onChange). Los RITM de prueba RITM0011022 / 0011023 tienen el sys_id del previsto de prueba (`43a9c509…`) en la variable porque se crearon cuando era referencia. No se rompe nada.

### 4.17 Gestión de cuenta en servidores Windows Pre-productivo (`716b40cf1b5ffad058f65425604bcb17`) — EN CURSO
- Planilla Remedy: Acción requerida (Otorgar / Modificar / Eliminar acceso), Nombre de usuario que requiere acceso (en AD Pre-productivo), Indique servidor(es) que requiere acceso (multilínea), "Ambiente / Hostname / Dirección IP" (etiqueta de texto enriquecido), Vigencia (Definida / Indefinida → Caducidad Vigencia, Fecha), Proyecto (Sí → nombre), Descripción detallada de la solicitud (multilínea). Grupo: Serv Windows Pre-Productivos.
- Revisión pide 2 cosas: (1) en "Indique servidor(es) que requiere acceso" aparece el texto enriquecido como variable y al revés; (2) el adjunto "Informe Solicitud de Ambiente.docx" no está disponible en la descripción.
- Plantilla Word recreada desde las capturas: `plantillas/Informe Solicitud de Ambiente.docx` (generador `plantillas/generar_informe_solicitud_ambiente.js`). El encabezado del banco va como franja de texto: si se tiene el original de Remedy, usar ese.
- Diagnóstico 07-10: prefijo `u_gest_cta_srv_win_pprod_` (algunas con doble guion bajo: `__vigencia`, `__proyecto`…). Flujo B exclusivo; solo usa `peticion_para`. Petición para (31) autollena RUT / Nombres / Apellidos / Usuario de Dominio con `BCHDatosUsuarioAjax`.
  - Causa (1): `amb_hostname_dir_ip` es Texto (6) obligatorio con ayuda "Indique servidor(es)…" y rich_text; debía ser etiqueta.
  - (2) 07-10: el original adjunto **no se puede descargar** → se usa el Word recreado `plantillas/Informe Solicitud de Ambiente.docx` (adjuntarlo al ítem y el script cambia el link). Antes: "Informe Solicitud de Ambiente - Base.docx" (`21c193233ba783106977352eb3e45a3f`); la traducción es ya tiene el link, la descripción base no.
- `scripts/win_pprod_hostname_y_adjunto.js` (**pendiente dry run**): inactiva `amb_hostname_dir_ip`, crea etiqueta `amb_hostname_dir_ip_texto` (32) en el mismo orden y pone el link al Word nuevo (`/sys_attachment.do`) en base y es.
- 07-10: el usuario pide la ayuda en vez de etiqueta → `scripts/win_pprod_hostname_como_ayuda.js` (**pendiente dry run**): ayuda visible "Ambiente / Hostname / Dirección IP" en `indique_srv_que_requiere_acceso` + inactiva la etiqueta `amb_hostname_dir_ip_texto`. Link del Word nuevo: confirmar si se adjuntó y se corrió.
- No pedido (Valores OK en la revisión): Acción se ve "Crear" / "Eliminar" y Vigencia "Temporal" / "Permanente" por traducciones globales (arreglo con `\u200B`); "Si" sin tilde; textos con espacio final; las 3 policies con orden 100.

### 4.18 Gestión de Cumplimiento Interno (`fc23e1321bd336d0d4f1a756624bcbc5`, prefijo `u_gest_cump_int_`, Flujo - Gestión_Cumplimiento_Interno, exclusivo) — POR COMPARAR CON REMEDY
- Diagnóstico 07-10:
  - Tipo de requerimiento con 8 opciones: Auditoría / Controles compensatorios / Facultades / Listados de usuarios en aplicaciones y plataformas / SOX - ICN / Control de vigencia en BD / Revocar sesión de usuarios / Otros controles. **Los values son el mismo texto, con espacios y tildes, y el Flow compara este value en 4 ramas "Si" → no cambiar values.**
  - Según el tipo:
    - Controles compensatorios: Indique N° Ciclo, Indique cantidad de usuarios (texto) y ¿Aplicación/Plataforma KPE? (Sí/no).
    - Revocar sesión: Indicar Usuarios (ayuda "separar por ;").
    - Control de vigencia en BD: Entorno (On-Premise / Cloud) + Indique usuarios (ayuda "separados por comas").
    - Otros controles: Indicar control.
    - Auditoría, Facultades, Listados y SOX: solo Detalles del requerimiento (obligatorio).
  - Sin descripción, sin set "Campos editables en consola" y sin client scripts.
- Observaciones:
  - Orden repetido (500 y 600 dos veces).
  - Las 5 policies con orden 100 y nombres con espacio final; a "Revocar Sesion" le falta la tilde.
  - Ninguna policy borra valor.
  - Separador de usuarios distinto (";" vs ",").
  - La ayuda de `indicar_usrs` termina con un salto de línea.
  - Cantidad de usuarios es texto (¿número?).
- Planilla Remedy 07-10: coincide en tipos y campos, salvo:
  - Revocar sesión: la etiqueta es 'Indique Usuarios (separados por ";")'.
  - Otros controles: **no tiene campo extra** (el nuestro pide "Indicar control…", confirmar si se deja).
  - "Indique usuarios" (Control de vigencia) es una línea en la planilla (el nuestro es multilínea).
  - "Detalles del requerimiento" figura como Selección múltiple (error de la planilla, se deja multilínea).
- Decisión 07-10: "Indicar Usuarios" de Revocar se deja como está (con ayuda); Otros controles e Indique usuarios sin cambio por ahora.
- `scripts/cump_int_ajustes_planilla.js` (**pendiente dry run**): borrar valor y nombres / orden de las policies, orden de 100 en 100.

### 4.19 Catálogo `4c1c1c441b004b5058f65425604bcb55` (grupos de AD: "Selecciona Empresa", "Seleccionar acción a ejecutar", "Crear grupo de AD") — EN CURSO
- Revisión (Orden de variables): los textos enriquecidos se ven distintos (unos desplegables desde "?", otros debajo del input) y la instrucción se lee después de escribir. Hay que pasarlos a ayuda visible de su variable (ej.: "Debe seleccionar la categoría más relevante para este grupo AD." → ayuda de "Seleccionar categoría").
- `scripts/ricos_a_ayuda.js` (genérico, **dry run OK 07-10: 3 etiquetas → seleccionar_categoria, nombre_proyecto, nombre_grupo_crear; falta false**). Prefijo `u_gest_grp_ad_apli_`, 2 variable sets: cada etiqueta 32 activa pasa a la ayuda visible de la variable anterior (o la de `DESTINO`) con traducción es, y la etiqueta se inactiva. El dry run muestra la anterior / siguiente y las policies de cada una.
- Las ayudas que hoy se despliegan con "?" (show_help sin show_help_on_load) también hay que dejarlas visibles: revisar con el diagnóstico.

### 4.20 Google Cloud Platform (`0cd9733b1bfb3a5058f65425604bcb61`, Ciberseguridad > Entorno Cloud) — EN REVISIÓN
- Planilla Remedy 07-10 (grupo Multicloud; célula → Equipo Operaciones Cloud CS):
  - Acción Requerida: Otorgar/Modificar Acceso → Vigencia (Definida → Caducidad vigencia, Fecha; Indefinida) + "Seleccione tipo de rol" (**casillas**: Consola de administración / Dominio de datos → "Indique nombre de matriz GCP", texto). Eliminar Acceso: sin campos extra.
  - Siempre: Indique cuenta T1 (texto, **no** obligatorio), Descripción de la solicitud (multilínea), ¿Esta solicitud está asociada a una célula? (Sí → Seleccione Célula).
  - Meta tag: GCP.
  - Descripción: "Esta solicitud tiene un acuerdo de atención con un plazo de hasta 5 días en horario de hábil. / Todo colaborador deberá contar con su cuenta T1 para acceder a los recursos de administración en GCP. Esta puede ser solicitada por la categoría "Gestión de Cuenta con Alto Privilegio T1" (en rojo), la asignación de estos accesos serán validados en la matriz de roles y privilegios vigente."
- Diagnóstico 07-10: prefijo `u_gcp_`, **Flujo I - Google_Cloud_Platform exclusivo** (no es el de Multicloud), compara `accion_requerida` en 2 ramas y usa la célula. Ya estaba homologado con Remedy: client scripts `GCP_LIMPIAR_*` y `GCP_VALIDAR_ROL`.
  - Hoy: Acción Creación (`otorgar_modificar_acceso`) / Modificación / Eliminación. ¿Colaborador interno o proveedor? Eliminar + interno → ¿Posee T1? → Indique cuenta T1; Eliminar → Indique rol a eliminar. Creación / Modificación → etiqueta "¿Requiere rol administrativo?" + casillas Consola / Dominio de datos (→ matriz GCP) + Vigencia → Caducidad. Siempre: Proyecto, Descripción detallada, ¿RBAC? y célula (set "Conjunto de celulas 2").
  - Diferencias con la planilla: 3 acciones (planilla 2), agrega colaborador/proveedor, Posee T1, rol a eliminar, Proyecto y RBAC; Indique cuenta T1 en la planilla va siempre y no es obligatoria; casilla "Consola **Admnistración**" (typo; planilla "Consola de administración").
  - Descripción: la base es igual a la planilla (sin link). La traducción es (la que ve el portal) tiene un link al catálogo T1 (`4adb8181…`), sin el rojo de la planilla.
- Revisión 07-10: todo OK salvo "Falta variable 'Indique T1' agregada en la planilla excel" (descripción OK). Decisión: como la planilla en ese punto.
- `scripts/gcp_indique_t1_como_planilla.js` (**aplicado 07-10, falta probar**; texto planilla en `planilla/gcp.md`). Flow revisado: rama Otorgar o Modificar = Creación OR Modificación, no se toca
- 07-10: el usuario pide Acción como la planilla (2 opciones) → `scripts/gcp_accion_como_planilla.js` (**pendiente dry run**): textos "Otorgar/Modificar Acceso" (value `otorgar_modificar_acceso`) y "Eliminar Acceso" (`eliminar_acceso`), `modificacion` inactiva. Values sin cambio → el Flow no se toca.: Indique cuenta T1 siempre visible y no obligatoria (la policy pasa a "Obligatorio - Indique cuenta T1 (Eliminación con T1)", solo obligatoria en Eliminación + interno + posee T1). Los onChange `GCP_LIMPIAR_ACCION` / `_COLAB` / `_POSEE` ya no la borran (POSEE se inactiva si queda vacío). Typo "Consola Admnistración" → "Consola de administración".

### 4.21 Imperva DBF (`2514b86e1bdb72d0d4f1a756624bcb16`, prefijo `u_imp_dbf_`) — POR COMPARAR CON LA PLANILLA
- Flow: **Flujo A - Sin Aprobación, compartido con 10 catálogos**. No usa variables → se pueden cambiar las variables, pero el Flow no se toca.
- Variables:
  - Tipo de Solicitud: requerimiento / incidente.
  - Seleccione su requerimiento (7 opciones), Seleccione tipo de incidente (4 opciones).
  - Servidor: solo para algunos requerimientos y para "Activación / Desactivación Agentes".
  - Descripción detallada de la solicitud.
- Observaciones:
  - Values con tildes y espacio (`gestión_de_politicas`, `instalación_agente`, `activación _desactivación_agentes`…) → no cambiar, las policies los comparan.
  - Las 3 variables condicionales son obligatorias en la variable.
  - Sin borrar valor.
  - Policies con orden 100 y nombres "Mostrar Requerimiento" y "Mostrar - Indicente " (typo, espacio).
  - "Tipo de Solicitud " con espacio final.
  - "Gestión de Politicas" sin tilde.
  - Descripción con typos ("Generacion de politicas", "desintalación").
- Revisión 07-10 (Reglas de visualización): al pasar de Requerimiento con servidor a Incidente, "Servidor" sigue visible. Causa: la policy de Servidor no exige Tipo = Requerimiento y el requerimiento oculto conserva su valor.
- `scripts/imperva_servidor_fix.js` (**aplicado 07-10, falta probar**; texto planilla en `planilla/imperva_dbf.md`): condición de Servidor con Tipo = Requerimiento / Incidente, borrar valor en las 3 policies, nombres y orden corregidos.
- Falta: planilla (seguirla al pie de la letra).

### 4.22 Microsoft Azure (`3f8130f82b99c7d0d8e0fc3c3291bf52`, prefijo `u_ms_az_`, Flujo I - Microsoft_Azure exclusivo) — POR COMPARAR CON LA PLANILLA
- Flow: usa `accion_requerida` (2 ramas) y la célula; values `otorgar_modificar_acceso` / `eliminar_acceso` → no cambiar.
- Hoy:
  - Acción: Otorgar/Modificar Acceso / Eliminar Acceso.
  - Otorgar/Modificar: ¿Colaborador interno o proveedor? → ¿Requiere rol administrativo? (Sí/no), Vigencia → Caducidad (Fecha).
  - Siempre: Proyecto (Sí/no, obligatorio), Descripción de la solicitud, célula (set, orden 600 = mismo que descripción).
  - **Indique cuenta T1 inactiva.**
- Observaciones:
  - "Eliminar Acceso" se ve "Eliminar" y Vigencia "Temporal / Permanente" por traducción global (arreglo `\u200B`).
  - El onChange de Acción (sin marcador, con `const` y flechas) borra también Descripción y Proyecto al cambiar la acción.
  - Policies sin borrar valor.
  - "Mostrar -  Obligatoriedad ¿…célula?" (doble espacio, debería ser "Obligatorio - …").
  - Caducidad obligatoria en la variable.
- Planilla 07-10: Acción (Otorgar/Modificar → Vigencia → Caducidad; Eliminar), **Indique cuenta T1 (texto, obligatoria)**, Descripción de la solicitud, célula. Vigencia sin "obligatorio" marcado en la planilla (se deja obligatoria, flag `VIGENCIA_OBLIGATORIA`). Revisión: falta Indique T1 y sobran campos (Proyecto…).
- `scripts/az_como_planilla.js` (**dry run OK 07-10, falta false y probar**; planilla V2 igual; texto planilla en `planilla/azure.md`): inactiva colaborador, rol administrativo y Proyecto (+ su policy); activa cuenta T1 obligatoria; policies con borrar valor y nombres; onChange de Acción reescrito (`AZ_LIMPIAR_ACCION`, ya no borra Descripción); `\u200B` en Eliminar Acceso / Definida / Indefinida; orden de la planilla.

### 4.23 Oracle Cloud Infrastructure (`aa0fe7a61bf37e10d4f1a756624bcbc2`, prefijo `oci_` sin `u_`, Flujo I - Oracle_Cloud_Infrastructure exclusivo) — EN CURSO
- Planilla V2 igual a Azure: Acción (Otorgar/Modificar → Vigencia → Caducidad; Eliminar), Indique cuenta T1 (obligatoria), Descripción de la solicitud, célula. Revisión: eliminar Proyecto y las condicionales que sobran.
- `scripts/oci_como_planilla.js` (**dry run OK 07-10, falta false y probar**; derivado de `az_como_planilla.js`; texto planilla en `planilla/oci.md`):
  - Inactiva colaborador, rol a eliminar, rol administrativo, Posee T1 y Proyecto, con 5 policies.
  - Cuenta T1 siempre visible y obligatoria.
  - Vigencia y Caducidad con condición simple y borrar valor.
  - onChange `OCI_LIMPIAR_ACCION`.
  - `\u200B` en Eliminar Acceso / Definida / Indefinida; orden.

### 4.24 Grupo "Automatizaciones UASC" (`22b89e393be94f502815757e53e45ac5`) — EN REVISIÓN
- Planilla: fila "Automatizaciones UASC", estado "Falta", 9 servicios, última columna "XSOAR UASC" (grupo `114c862c2b9587d0d8e0fc3c3291bf96`).
- `scripts/buscar_grupo_uasc.js` 07-10:
  - 13 ítems con Automatizaciones UASC, todos en Grupo de cumplimiento (`group`). Ningún Flow asigna el grupo por sys_id, y nadie usa XSOAR UASC.
  - En la planilla y con el grupo: VDI 2.0, GCP externos (5b8b015e), Extensión de Vigencia, Gestión VPN Colaborador Interno, Protocolo Extranjero, Activar Cuentas Temporales, Reset de Contraseña - Cuentas de Dominio (f64c0a12 activo; 86058830 inactivo).
  - En la planilla **sin** el grupo: Desvincular dispositivo de MFA (Robo, Hurto o Pérdida) (0a05b140, grupo MFA).
  - Con el grupo pero tachados o fuera de la planilla: Cambio/Restablecimiento de contraseña (a8b17932), Cambio/Restablecimiento T1, T2 y Casillas (b79cc583), Acceso Citrix VDI Remoto (inactivo), "Habilitación de VPN para Colaborador Interno" d0bdf1ef (= Navegación Privilegiada, nombre base mal copiado), Solicitud Certificadores QA (823e4132).
- Pendiente: que el usuario confirme qué pide la planilla (¿cambiar a XSOAR UASC? ¿sacar el grupo de los tachados? ¿agregar MFA?).

### 4.25 Grupos de la planilla (filas "Falta" / "Falta (parecido)") — REVISADO 07-10
- `scripts/revisar_grupos_planilla.js`. Todos los grupos existen (0 miembros: aún no se cargan).
- OK: Multicloud (5 catálogos, Grupo tarea 1), Gestión Grupos AD, Excepción reemplazo, Excepción MFA SWIFT, Excepción Perfil Matriz Cargo Perfil, Servicios Cloud, Gestión BD, Gestión Exchange, Data deudores, RDP, UASC (Grupo tarea 3 de Permisos de Conexión RDP).
- Pendiente:
  - **Desvincular dispositivo de MFA - Banchile Inversiones** (`6c9e2bd7…`) tiene "MFA"; la planilla pide "Desenrolamiento MFA - Banchile" (`ec4c462c…`).
  - **Data Safe**: el activo se llama "Copy of Data Safe" (`5d9891d2…`, con el grupo) y el "Data Safe" original (`5329d94d…`) está inactivo y sin grupo.
  - **Equipo P&O**: el grupo existe como "Equipo P&0" (con cero), en Grupo tarea 3 de Grupo Renuncia (`b3cb2f60…`).
  - " Excepción Perfil Matriz Cargo Perfil" (`719d11f8…`) tiene un espacio al inicio del nombre.
- Los 12 catálogos de UASC ya tienen **XSOAR UASC** como Grupo de cumplimiento (cambiado por alguien después de 4.24). "Recursos Compartidos - Socofin" usa UASC - Socofin.

### 4.26 Divisional del previsto (para aprobaciones, ej. Permisos de Conexión RDP)
- sys_user no tiene un campo "divisional". Propuesta: grupo **"Divisionales"** + Script Include **`BCHDivisional.getDivisional(user)`**, que sube por `manager` hasta el primer miembro del grupo. En el Flow se usa una Action "Obtener divisional" (paso de script, se crea a mano en Flow Designer); su output va a "Solicitar aprobación", con rama de respaldo si no encuentra.
- Orden: 1) `crear_grupo_divisionales.js` (lista de divisionales: BCH, o candidatos por cargo). 2) `crear_bch_divisional.js`. 3) La Action. 4) `diag_aprobaciones_flow.js` del Flow de RDP para ver qué paso cambiar.
- Decisión 07-10: **sin Script Include**; la lógica va en el paso Script de la Action (`scripts/action_obtener_divisional.js`). **Si no encuentra divisional → jefatura directa** (origen = 'jefe', nota de trabajo en el RITM). Si no tiene jefatura → grupo de respaldo.
- Definir con BCH: si el previsto es divisional (¿él mismo o su jefatura?), la rama de respaldo y quién mantiene el grupo.

## 5. Pendientes generales
- Aclarar Go Live (02-10-2026): ¿se movió? ¿qué update sets se promovieron? Riesgo de arrastrar cambios a medias de 4.7/4.8.
- Script de verificación solo lectura para 4.1, 4.2 y 4.8 (client scripts activos, estado de `clase_cta_unix`, texto de opciones de Vigencia).
- Seguridad `BCHDatosUsuarioAjax` (ver sección 3).
- Coordinar con Kathy la traducción global Definida/Temporal (afecta ~17 catálogos).
- Documento de dudas BCH: aplicativos/plataformas sin equivalente, célula vs proyecto ágil, "Seleccione recurso nube" API vs AWS, ayuda de `nombre_cuenta`.
- Planilla: Revisión/Deshabilitación de Agentes sin estado; Filtro en Firewall marcar como trabajado.

- 07-10: **el usuario exige el formulario EXACTO a la planilla** (en el portal las casillas de rol no salían con Otorgar/Modificar porque dependían de Colaborador). `scripts/gcp_como_planilla.js` (**dry run OK 07-10, falta false y probar**): inactiva colaborador_proveedor, posee_cuenta_t1, indique_rol_eliminar, es_proyecto, requiere_rbac y sus policies + onChange COLAB; policies solo con Acción = Otorgar/Modificar; onSubmit GCP_VALIDAR_ROL sin colaborador; textos "Seleccione tipo de rol" / "Descripción de la solicitud"; orden de la planilla. **Regla: cuando hay planilla, seguir la planilla al pie de la letra.**
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
Guardado en `scripts/diag_catalogo.js`. Cambiar `ITEM_ID`. Muestra variables del ítem y de los sets (tipo, obligatoria, default, referencia / lookup, ayuda + traducción, opciones con traducción, marca `\u200B`), sets con `io_set_item.order`, policies con condiciones IO: traducidas y sus acciones, client scripts (código; `PRINT_CODE=false` para acortar), Script Includes llamados por GlideAjax y el Flow.

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

---

## 8. Índice de scripts (`scripts/`)
| Script | Catálogo | Tipo | Estado |
|---|---|---|---|
| `diag_completo.js` | genérico (hoy 6533bf81…) | solo lectura | diag_catalogo + diag_flow en uno: usar en cada catálogo nuevo |
| `diag_catalogo.js` | genérico (cambiar ITEM_ID) | solo lectura | usar en cada catálogo nuevo |
| `buscar_uso_nombre_catalogo.js` | genérico (hoy VPN 4.13) | solo lectura | volver a correr |
| `quitar_ninguno_variable.js` | genérico (hoy Renombrar Usuario) | modifica | en 4.12 no hizo falta (`include_none` ya en 0) |
| `renusr_tipo_cuenta_sin_seleccion.js` | 4.12 | modifica | dry run OK, falta false |
| `diag_flow_catalogo.js` | genérico (hoy T0 4.14) | solo lectura | correr para T0 |
| `t0_vigencia_solo_crear.js` | 4.14 | modifica | aplicado |
| `t0_orden_variables.js` | 4.14 | modifica | pendiente |
| `t1_usuario_dominio_y_caducidad.js` | 4.15 | modifica | aplicado (caducidad ya es Fecha) |
| `t1_ajustes_planilla.js` | 4.15 | modifica | aplicado (atributos ref_ac no sirven en el portal) |
| `t1_usuario_dominio_texto.js` | 4.15 | modifica (crea Script Include) | aplicado (SI 9210e11d3b73cb106977352eb3e45a49) |
| `t2_usuario_dominio_y_caducidad.js` | 4.16 | modifica | dry run OK, falta false |
| `win_pprod_hostname_y_adjunto.js` | 4.17 | modifica | aplicado (etiqueta luego reemplazada por ayuda) |
| `win_pprod_hostname_como_ayuda.js` | 4.17 | modifica | pendiente dry run |
| `cump_int_ajustes_planilla.js` | 4.18 | modifica | pendiente dry run |
| `ricos_a_ayuda.js` | genérico (hoy 4c1c1c44…) | modifica | dry run OK en 4c1c1c44 (3 etiquetas), falta false |
| `gcp_indique_t1_como_planilla.js` | 4.20 | modifica | aplicado 07-10 |
| `gcp_accion_como_planilla.js` | 4.20 | modifica | pendiente dry run |
| `gcp_como_planilla.js` | 4.20 | modifica | dry run OK, falta false (formulario exacto a la planilla) |
| `verificar_gcp.js` | 4.20 | solo lectura | verificación (actualizar tras gcp_como_planilla) |
| `imperva_servidor_fix.js` | 4.21 | modifica | aplicado 07-10 |
| `az_como_planilla.js` | 4.22 | modifica | dry run OK, falta false (formulario exacto a la planilla) |
| `oci_como_planilla.js` | 4.23 | modifica | dry run OK, falta false (formulario exacto a la planilla V2) |
| `verificar_usuario_dominio_flow.js` | 4.15 / 4.16 | solo lectura | ¿el Flow o algo usa usuario_dominio como referencia? |
| `renombrar_catalogos_vpn.js` | 4.13 | modifica (si no hay usos) | aplicado 07-10 (ambos renombrados) |
| `aws_como_planilla.js` | 4.10 | modifica | pendiente dry run (como planilla Azure/OCI; confirmar con planilla AWS) |
| `buscar_grupo_uasc.js` | 4.24 | solo lectura | corrido 07-10 |
| `revisar_grupos_planilla.js` | 4.25 | solo lectura | corrido 07-10 |
| `diag_aprobaciones_flow.js` | genérico (hoy RDP) | solo lectura | a quién apuntan las aprobaciones del Flow |
| `cadena_jefaturas.js` | genérico | solo lectura | cadena de manager de un usuario, marca el divisional por cargo |
| `crear_grupo_divisionales.js` | general | modifica | crea grupo Divisionales + miembros (pendiente lista) |
| `crear_bch_divisional.js` | general | modifica | Script Include BCHDivisional.getDivisional (pendiente) |
| `action_obtener_divisional.js` | 4.26 | código de Action | paso Script de la Action "Obtener divisional" (respaldo: jefatura directa) |
| `diag_wo_types_variables.js` | Action Llenar Wo Types | solo lectura | corrido OK |
| `diag_multicloud_31c84063.js`, `diag_flow_multicloud.js` | 4.9 | solo lectura | — |
| `multicloud_caducidad_fecha_hora.js` | 4.9 | modifica | aplicado |
| `multicloud_rol_admin_como_remedy.js` | 4.9 | modifica | aplicado (corrección 1) |
| `multicloud_rol_admin_gcp.js` | 4.9 | modifica | aplicado (corrección 2) |
| `multicloud_modificacion_como_creacion.js` | 4.9 | modifica | confirmar |
| `multicloud_eliminacion.js` | 4.9 | modifica | dry run OK, confirmar false |
| `prueba_multicloud_crear_tickets.js` | 4.9 | crea RITM | corrido (RITM0011087–0011092) |
| `prueba_multicloud_revisar_tickets.js`, `prueba_multicloud_buscar_wo.js` | 4.9 | lectura (`APROBAR=true` aprueba) | revisar resultados |

### 4.27 Cierre automático RITM (Terminado 3 → Cerrado 4) en días hábiles
- Script original: 24x7 (38fa64edc0a8016400f4a5724b0434b8) + sys_updated_on → días continuos y se reinicia con cualquier actualización.
- Job: **BCH - Auto-close completed RITM** (sysauto_script 50dccb2d3b71c3502815757e53e45a11), INACTIVO, diario 00:00. 40 RITM en Terminado (3=Terminado, 4=Cerrado OK).
- Lógica vieja rota: el `schedule.add` 24x7 casi siempre devolvía la misma fecha → cerraba al tiro (sin esperar los 3 días) y medía desde sys_updated_on.
- "8-5 weekdays excluding holidays" usa U.S. Holidays → NO sirve. Usar **Feriados CHILE** (0cd818111b6924501df3bb7f034bcb0a, 16 feriados 2026; calendario de feriados: día dentro = no hábil). Cargar 2027 a fin de año.
- Nuevo: `scripts/cierre_auto_ritm_habiles.js` (lun-vie menos Feriados CHILE; propiedad opcional `bch.ciber.ritm.cierre.auto.feriados`; fecha de término = auditoría del cambio a state 3 → closed_at → sys_updated_on). Simulación: 19 de 40 se cerrarían al activarlo.
- Diagnóstico solo lectura: `scripts/diag_cierre_auto_ritm.js` (dónde está el job, estados, calendarios/feriados, simulación continuo vs hábil).
- Aplicar al job (queda INACTIVO): `scripts/actualizar_job_cierre_auto_ritm.js` (imprime respaldo del script anterior). **APLICADO** (job con script días hábiles, activo=0; falta probar con DRY_RUN=true y activar cuando lo aprueben).
- Prueba por RITM: `scripts/probar_cierre_auto_ritm.js` (lista RITMS, detalle día a día, DRY_RUN=false cierra solo los que cumplen).
