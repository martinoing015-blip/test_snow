/*
 * Actualiza el script del Scheduled Job "BCH - Auto-close completed RITM" con el cierre en DÍAS HÁBILES
 * (lunes a viernes, sin Feriados CHILE) y lo deja INACTIVO.
 * Antes de cambiar imprime el script actual completo (respaldo).
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false MODIFICA el job (script + inactivo)
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var JOB_ID = '50dccb2d3b71c3502815757e53e45a11';   // BCH - Auto-close completed RITM

var NUEVO = [
    "// ===========================================================",
    "// Cierre automático RITM — Instancia Ciberseguridad BCH",
    "// Terminado (3) -> Cerrado (4) tras N días HÁBILES (lunes a viernes, sin feriados de Chile)",
    "// Días: propiedad bch.ciber.ritm.cierre.auto.dias (por defecto 3)",
    "// Feriados: calendario \"Feriados CHILE\" (cmn_schedule 0cd818111b6924501df3bb7f034bcb0a);",
    "//   se puede cambiar con la propiedad bch.ciber.ritm.cierre.auto.feriados",
    "// Fecha de término: cuando el RITM pasó a Terminado (auditoría); si no hay, closed_at; si no, sys_updated_on",
    "// Ejemplo (3 días): terminado viernes 10:00 -> se cierra el miércoles a partir de las 10:00",
    "// Probar como Background Script con DRY_RUN = true (solo lista). En el Scheduled Job: DRY_RUN = false",
    "// ===========================================================",
    "var DRY_RUN = false;",
    "",
    "var dias = parseInt(gs.getProperty('bch.ciber.ritm.cierre.auto.dias', '3'), 10);",
    "var feriadosId = gs.getProperty('bch.ciber.ritm.cierre.auto.feriados', '0cd818111b6924501df3bb7f034bcb0a');",
    "function cargarFeriados(id) {",
    "    // lee los tramos del calendario de feriados (cmn_schedule_span) → { 'yyyy-mm-dd': nombre }; los anuales quedan como 'mm-dd'",
    "    var set = {}, s = new GlideRecord('cmn_schedule_span');",
    "    s.addQuery('schedule', id); s.query();",
    "    while (s.next()) {",
    "        var ini = s.getValue('start_date_time') || '', fin = s.getValue('end_date_time') || ini;",
    "        if (ini.length < 8) continue;",
    "        var anual = s.getValue('repeat_type') == 'yearly';",
    "        var d = Date.UTC(+ini.substr(0, 4), +ini.substr(4, 2) - 1, +ini.substr(6, 2));",
    "        var f = Date.UTC(+fin.substr(0, 4), +fin.substr(4, 2) - 1, +fin.substr(6, 2));",
    "        if (fin.substr(9, 6) == '000000' && f > d) f -= 86400000;         // termina a las 00:00 del día siguiente",
    "        for (var g = 0; d <= f && g < 15; g++, d += 86400000) {",
    "            var key = new Date(d).toISOString().substr(0, 10);",
    "            set[anual ? key.substr(5) : key] = s.getValue('name') || 'feriado';",
    "        }",
    "    }",
    "    return set;",
    "}",
    "var FERIADOS = cargarFeriados(feriadosId);",
    "",
    "function esHabil(gdt) {",
    "    if (gdt.getDayOfWeekLocalTime() > 5) return false;                    // sábado (6) y domingo (7)",
    "    var key = gdt.getLocalDate().getValue();                              // yyyy-mm-dd",
    "    return !FERIADOS[key] && !FERIADOS[key.substr(5)];                    // feriado de \"Feriados CHILE\" = no hábil",
    "}",
    "function sumarHabiles(desde, n) {",
    "    var d = new GlideDateTime(desde), k = 0, guard = 0;",
    "    while (k < n && guard++ < 60) { d.addDaysLocalTime(1); if (esHabil(d)) k++; }",
    "    return d;",
    "}",
    "function fechaTermino(ritm) {",
    "    var a = new GlideRecord('sys_audit');",
    "    a.addQuery('tablename', 'sc_req_item'); a.addQuery('documentkey', ritm.getUniqueValue());",
    "    a.addQuery('fieldname', 'state'); a.addQuery('newvalue', '3');",
    "    a.orderByDesc('sys_created_on'); a.setLimit(1); a.query();",
    "    if (a.next()) return new GlideDateTime(a.getValue('sys_created_on'));",
    "    if (ritm.getValue('closed_at')) return new GlideDateTime(ritm.getValue('closed_at'));",
    "    return new GlideDateTime(ritm.getValue('sys_updated_on'));",
    "}",
    "",
    "if (DRY_RUN) {",
    "    gs.print('DRY_RUN = true | días hábiles: ' + dias + ' | calendario de feriados: ' + feriadosId + ' | feriados cargados: ' + Object.keys(FERIADOS).length);",
    "    // muestra los días no hábiles (feriados de lunes a viernes) de los próximos 120 días, para confirmar que lee bien el calendario",
    "    var f = new GlideDateTime(), lista = [];",
    "    for (var i = 0; i < 120; i++) { f.addDaysLocalTime(1); if (f.getDayOfWeekLocalTime() <= 5 && !esHabil(f)) lista.push(f.getLocalDate().getDisplayValue()); }",
    "    gs.print('Feriados (lun-vie) detectados en los próximos 120 días: ' + (lista.join(', ') || '(ninguno ⚠️ revisar el calendario)'));",
    "}",
    "",
    "var ahora = new GlideDateTime();",
    "var gr = new GlideRecord('sc_req_item');",
    "gr.addEncodedQuery('state=3'); // RITM Terminados (instancia 100% Ciber)",
    "gr.query();",
    "",
    "var contador = 0, pendientes = 0;",
    "while (gr.next()) {",
    "    var fechaCierre = sumarHabiles(fechaTermino(gr), dias);",
    "    if (!fechaCierre.before(ahora)) { pendientes++; continue; }",
    "    contador++;",
    "    if (DRY_RUN) { gs.print('• cerraría ' + gr.getValue('number') + ' (le tocaba desde ' + fechaCierre.getDisplayValue() + ')'); continue; }",
    "    gr.state = 4; // Cerrado",
    "    gr.work_notes = 'Requerimiento cerrado automáticamente por sistema (' + dias + ' días hábiles desde su término).';",
    "    gr.update();",
    "}",
    "gs.info('[Cierre auto RITM Ciber] ' + (DRY_RUN ? 'DRY RUN, se cerrarían: ' : 'Cerrados: ') + contador + ' | aún en plazo: ' + pendientes + ' | días hábiles: ' + dias);",
    "if (DRY_RUN) gs.print('Se cerrarían: ' + contador + ' | aún en plazo: ' + pendientes + ' (DRY RUN, nada modificado)');"
].join('\n');

gs.print('DRY_RUN = ' + DRY_RUN);
var j = new GlideRecord('sysauto_script');
if (!j.get(JOB_ID)) gs.print('❌ No existe el job ' + JOB_ID);
else {
    gs.print('Job: ' + j.getValue('name') + ' | activo=' + j.getValue('active') + ' | corre: ' + j.getDisplayValue('run_type') + ' ' + (j.getDisplayValue('run_time') || ''));
    gs.print('\n----- SCRIPT ACTUAL (respaldo) -----\n' + j.getValue('script') + '\n----- FIN SCRIPT ACTUAL -----');
    if (j.getValue('script') == NUEVO) gs.print('\n• el script ya está actualizado');
    else gs.print('\n• reemplazar script por la versión días hábiles (' + NUEVO.split('\n').length + ' líneas)');
    gs.print('• dejar activo = false' + (j.getValue('active') == '1' ? ' (hoy está ACTIVO)' : ' (ya está inactivo)'));
    if (!DRY_RUN) {
        j.setValue('script', NUEVO);
        j.setValue('active', false);
        j.update();
        var v = new GlideRecord('sysauto_script'); v.get(JOB_ID);
        gs.print('\nVerificación: activo=' + v.getValue('active') + ' | script igual al nuevo: ' + (v.getValue('script') == NUEVO ? 'SÍ ✅' : 'NO ❌'));
    }
}
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
