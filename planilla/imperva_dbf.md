# Imperva DBF — texto para la planilla

**Modificación:** Se corrige que "Servidor" quedara visible al cambiar de Requerimiento a Incidente.

**Detalle:**
- UI Policy "Mostrar - Servidor": la condición ahora exige Tipo de Solicitud = Requerimiento (con Solicitud de información, Cambios en Agente, Instalación Agente, Registro Agente o Gestión de cuentas) o Tipo de Solicitud = Incidente (con Activación / Desactivación Agentes). Borra el valor al ocultarse.
- UI Policies "Mostrar - Seleccione su requerimiento" (antes "Mostrar Requerimiento") y "Mostrar - Seleccione tipo de incidente" (antes "Mostrar - Indicente"): borran el valor al ocultarse.
- Orden de policies: 100 / 200 / 300, y Solo lectura al final.
- Flow (Flujo A - Sin Aprobación, compartido): sin cambios.
