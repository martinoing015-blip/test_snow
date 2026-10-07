// ===========================================================
// Cierre automático RITM — Instancia Ciberseguridad BCH
// Terminado (3) -> Cerrado (4) tras N días HÁBILES (lun-vie, sin feriados)
// Calendario hábil: propiedad bch.ciber.ritm.cierre.auto.calendario
//   (sys_id de cmn_schedule con los feriados de Chile excluidos, ej. "8-5 weekdays excluding holidays")
// Fecha de término: cuando el RITM pasó a Terminado (auditoría); si no hay, closed_at; si no, sys_updated_on
// Para probar como Background Script: DRY_RUN = true (solo lista). En el Scheduled Job: DRY_RUN = false
// ===========================================================
var DRY_RUN = false;

var dias = parseInt(gs.getProperty('bch.ciber.ritm.cierre.auto.dias', '3'), 10);
var calId = gs.getProperty('bch.ciber.ritm.cierre.auto.calendario', '');
var cal = calId ? new GlideSchedule(calId) : null;

function esHabil(gdt) {
    if (gdt.getDayOfWeekLocalTime() > 5) return false;                    // sábado (6) y domingo (7)
    if (!cal) return true;
    var mediodia = new GlideDateTime();
    mediodia.setDisplayValueInternal(gdt.getLocalDate().getValue() + ' 12:00:00');
    return cal.isInSchedule(mediodia);                                    // feriado = fuera del calendario
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

if (!cal) gs.warn('[Cierre auto RITM Ciber] Sin calendario hábil (propiedad bch.ciber.ritm.cierre.auto.calendario): solo se excluyen sábados y domingos, NO feriados');

var ahora = new GlideDateTime();
var gr = new GlideRecord('sc_req_item');
gr.addEncodedQuery('state=3'); // RITM Terminados (instancia 100% Ciber)
gr.query();

var contador = 0;
while (gr.next()) {
    var fechaCierre = sumarHabiles(fechaTermino(gr), dias);
    if (fechaCierre.before(ahora)) {
        contador++;
        if (DRY_RUN) { gs.print('• cerraría ' + gr.getValue('number') + ' (fecha de cierre hábil: ' + fechaCierre.getDisplayValue() + ')'); continue; }
        gr.state = 4; // Cerrado
        gr.work_notes = 'Requerimiento cerrado automáticamente por sistema (' + dias + ' días hábiles desde su término).';
        gr.update();
    }
}
gs.info('[Cierre auto RITM Ciber] ' + (DRY_RUN ? 'DRY RUN, se cerrarían: ' : 'Cerrados: ') + contador + ' | días hábiles: ' + dias);
if (DRY_RUN) gs.print('Total: ' + contador + ' (DRY RUN, nada modificado)');
