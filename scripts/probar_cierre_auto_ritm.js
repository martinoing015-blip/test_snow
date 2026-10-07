/*
 * Prueba del cierre automático en días hábiles, RITM por RITM.
 * Usa la MISMA lógica del job "BCH - Auto-close completed RITM" (lunes a viernes, sin Feriados CHILE,
 * desde que el RITM pasó a Terminado) y muestra para cada RITM: estado, fecha de término, días contados
 * (cuáles se saltó por fin de semana o feriado), fecha de cierre y si se cerraría hoy.
 * Cuenta: ADMIN | DRY_RUN=true solo lectura | DRY_RUN=false CIERRA (state 4) los RITM de la lista que ya cumplen el plazo
 * (scope Global, update set seleccionado, "Record for rollback?" marcado)
 */
var DRY_RUN = true;
var RITMS = ['RITM0010524', 'RITM0010627', 'RITM0011093'];   // números de RITM a probar

var dias = parseInt(gs.getProperty('bch.ciber.ritm.cierre.auto.dias', '3'), 10);
var feriadosId = gs.getProperty('bch.ciber.ritm.cierre.auto.feriados', '0cd818111b6924501df3bb7f034bcb0a');
var feriados = new GlideSchedule(feriadosId);
var NOMBRE_DIA = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

function motivoNoHabil(gdt) {
    if (gdt.getDayOfWeekLocalTime() > 5) return 'fin de semana';
    var mediodia = new GlideDateTime();
    mediodia.setDisplayValueInternal(gdt.getLocalDate().getValue() + ' 12:00:00');
    return feriados.isInSchedule(mediodia) ? 'feriado' : '';
}
function fechaTermino(ritm) {
    var a = new GlideRecord('sys_audit');
    a.addQuery('tablename', 'sc_req_item'); a.addQuery('documentkey', ritm.getUniqueValue());
    a.addQuery('fieldname', 'state'); a.addQuery('newvalue', '3');
    a.orderByDesc('sys_created_on'); a.setLimit(1); a.query();
    if (a.next()) return { f: new GlideDateTime(a.getValue('sys_created_on')), o: 'auditoría' };
    if (ritm.getValue('closed_at')) return { f: new GlideDateTime(ritm.getValue('closed_at')), o: 'closed_at' };
    return { f: new GlideDateTime(ritm.getValue('sys_updated_on')), o: 'sys_updated_on' };
}

gs.print('DRY_RUN = ' + DRY_RUN + ' | días hábiles: ' + dias + ' | feriados: ' + feriadosId);
var ahora = new GlideDateTime();
RITMS.forEach(function (num) {
    var gr = new GlideRecord('sc_req_item');
    if (!gr.get('number', num)) { gs.print('\n❌ ' + num + ': no existe'); return; }
    gs.print('\n=== ' + num + ' | ' + gr.getDisplayValue('cat_item') + ' | estado: ' + gr.getDisplayValue('state') + ' (' + gr.getValue('state') + ')');
    if (gr.getValue('state') != '3') { gs.print('   ⏭ no está Terminado (3): el job no lo toca'); return; }

    var t = fechaTermino(gr);
    gs.print('   terminado: ' + t.f.getDisplayValue() + ' (' + NOMBRE_DIA[t.f.getDayOfWeekLocalTime()] + ', según ' + t.o + ') | última actualización: ' + gr.getDisplayValue('sys_updated_on'));
    var d = new GlideDateTime(t.f), k = 0, guard = 0, detalle = [];
    while (k < dias && guard++ < 60) {
        d.addDaysLocalTime(1);
        var m = motivoNoHabil(d);
        if (m) detalle.push(d.getLocalDate().getDisplayValue() + ' ' + NOMBRE_DIA[d.getDayOfWeekLocalTime()] + ' ✗ ' + m);
        else { k++; detalle.push(d.getLocalDate().getDisplayValue() + ' ' + NOMBRE_DIA[d.getDayOfWeekLocalTime()] + ' ✓ hábil ' + k); }
    }
    detalle.forEach(function (x) { gs.print('     ' + x); });
    var cumple = d.before(ahora);
    gs.print('   cierre a partir de: ' + d.getDisplayValue() + ' → ' + (cumple ? '✅ SE CIERRA' : '⏳ aún en plazo (no se cierra)'));

    if (cumple && !DRY_RUN) {
        gr.state = 4; // Cerrado
        gr.work_notes = 'Requerimiento cerrado automáticamente por sistema (' + dias + ' días hábiles desde su término).';
        gr.update();
        var v = new GlideRecord('sc_req_item'); v.get(gr.getUniqueValue());
        gs.print('   → cerrado. Estado ahora: ' + v.getDisplayValue('state') + ' (' + v.getValue('state') + ')');
    }
});
gs.print('\nFIN' + (DRY_RUN ? ' (DRY RUN, nada modificado)' : ' (cambios aplicados)'));
