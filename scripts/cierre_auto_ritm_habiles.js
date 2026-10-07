// ===========================================================
// Cierre automático RITM — Instancia Ciberseguridad BCH
// Terminado (3) -> Cerrado (4) tras N días HÁBILES (lunes a viernes, sin feriados de Chile)
// Días: propiedad bch.ciber.ritm.cierre.auto.dias (por defecto 3)
// Feriados: calendario "Feriados CHILE" (cmn_schedule 0cd818111b6924501df3bb7f034bcb0a);
//   se puede cambiar con la propiedad bch.ciber.ritm.cierre.auto.feriados
// Fecha de término: cuando el RITM pasó a Terminado (auditoría); si no hay, closed_at; si no, sys_updated_on
// Ejemplo (3 días): terminado viernes 10:00 -> se cierra el miércoles a partir de las 10:00
// Probar como Background Script con DRY_RUN = true (solo lista). En el Scheduled Job: DRY_RUN = false
// ===========================================================
var DRY_RUN = false;

var dias = parseInt(gs.getProperty('bch.ciber.ritm.cierre.auto.dias', '3'), 10);
var feriadosId = gs.getProperty('bch.ciber.ritm.cierre.auto.feriados', '0cd818111b6924501df3bb7f034bcb0a');
var feriados = new GlideSchedule(feriadosId);

function esHabil(gdt) {
    if (gdt.getDayOfWeekLocalTime() > 5) return false;                    // sábado (6) y domingo (7)
    var mediodia = new GlideDateTime();
    mediodia.setDisplayValueInternal(gdt.getLocalDate().getValue() + ' 12:00:00');
    return !feriados.isInSchedule(mediodia);                              // día dentro de "Feriados CHILE" = no hábil
}
function sumarHabiles(desde, n) {
    var d = new GlideDateTime(desde), k = 0, guard = 0;
    while (k < n && guard++ < 60) { d.addDaysLocalTime(1); if (esHabil(d)) k++; }
    return d;
}
function fechaTermino(ritm) {
    var a = new GlideRecord('sys_audit');
    a.addQuery('tablename', 'sc_req_item'); a.addQuery('documentkey', ritm.getUniqueValue());
    a.addQuery('fieldname', 'state'); a.addQuery('newvalue', '3');
    a.orderByDesc('sys_created_on'); a.setLimit(1); a.query();
    if (a.next()) return new GlideDateTime(a.getValue('sys_created_on'));
    if (ritm.getValue('closed_at')) return new GlideDateTime(ritm.getValue('closed_at'));
    return new GlideDateTime(ritm.getValue('sys_updated_on'));
}

if (DRY_RUN) {
    gs.print('DRY_RUN = true | días hábiles: ' + dias + ' | calendario de feriados: ' + feriadosId);
    // muestra los días no hábiles (feriados de lunes a viernes) de los próximos 120 días, para confirmar que lee bien el calendario
    var f = new GlideDateTime(), lista = [];
    for (var i = 0; i < 120; i++) { f.addDaysLocalTime(1); if (f.getDayOfWeekLocalTime() <= 5 && !esHabil(f)) lista.push(f.getLocalDate().getDisplayValue()); }
    gs.print('Feriados (lun-vie) detectados en los próximos 120 días: ' + (lista.join(', ') || '(ninguno ⚠️ revisar el calendario)'));
}

var ahora = new GlideDateTime();
var gr = new GlideRecord('sc_req_item');
gr.addEncodedQuery('state=3'); // RITM Terminados (instancia 100% Ciber)
gr.query();

var contador = 0, pendientes = 0;
while (gr.next()) {
    var fechaCierre = sumarHabiles(fechaTermino(gr), dias);
    if (!fechaCierre.before(ahora)) { pendientes++; continue; }
    contador++;
    if (DRY_RUN) { gs.print('• cerraría ' + gr.getValue('number') + ' (le tocaba desde ' + fechaCierre.getDisplayValue() + ')'); continue; }
    gr.state = 4; // Cerrado
    gr.work_notes = 'Requerimiento cerrado automáticamente por sistema (' + dias + ' días hábiles desde su término).';
    gr.update();
}
gs.info('[Cierre auto RITM Ciber] ' + (DRY_RUN ? 'DRY RUN, se cerrarían: ' : 'Cerrados: ') + contador + ' | aún en plazo: ' + pendientes + ' | días hábiles: ' + dias);
if (DRY_RUN) gs.print('Se cerrarían: ' + contador + ' | aún en plazo: ' + pendientes + ' (DRY RUN, nada modificado)');
