/*
 * Diagnóstico del cierre automático de RITM (Terminado → Cerrado) — SOLO LECTURA
 * 1) Dónde está el script (Scheduled Job / Business Rule) y cada cuánto corre
 * 2) Estados de sc_req_item (confirmar que 3 = Terminado y 4 = Cerrado)
 * 3) Calendarios candidatos de días hábiles y si tienen feriados cargados
 * 4) Simulación: qué RITM Terminados se cerrarían hoy con días CONTINUOS (lógica actual) vs días HÁBILES
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var CALENDARIO = '';          // sys_id del calendario hábil a simular (vacío = usa el primero "8-5 weekdays excluding holidays")
var DIAS = parseInt(gs.getProperty('bch.ciber.ritm.cierre.auto.dias', '3'), 10);
var MAX_LINEAS = 40;

// 1) Dónde está
gs.print('=== 1) Dónde está el script');
[['sysauto_script', 'Scheduled Job'], ['sys_script', 'Business Rule']].forEach(function (t) {
    var j = new GlideRecord(t[0]); j.addQuery('script', 'CONTAINS', 'Cierre auto RITM Ciber'); j.query();
    while (j.next()) gs.print('• ' + t[1] + ': ' + j.getValue('name') + ' (' + j.getUniqueValue() + ') | activo=' + j.getValue('active') +
        (t[0] == 'sysauto_script' ? ' | corre: ' + j.getDisplayValue('run_type') + ' ' + (j.getDisplayValue('run_time') || '') : ' | tabla: ' + j.getValue('collection') + ' | when: ' + j.getValue('when')));
});
gs.print('Propiedad bch.ciber.ritm.cierre.auto.dias = ' + gs.getProperty('bch.ciber.ritm.cierre.auto.dias', '(no existe, usa 3)'));
gs.print('Propiedad bch.ciber.ritm.cierre.auto.calendario = ' + gs.getProperty('bch.ciber.ritm.cierre.auto.calendario', '(no existe)'));

// 2) Estados
gs.print('\n=== 2) Estados de sc_req_item');
var ch = new GlideRecord('sys_choice'); ch.addQuery('name', 'sc_req_item'); ch.addQuery('element', 'state'); ch.addQuery('inactive', false); ch.orderBy('language'); ch.orderBy('sequence'); ch.query();
while (ch.next()) gs.print('• [' + ch.getValue('language') + '] ' + ch.getValue('value') + ' = ' + ch.getValue('label'));
var cnt = new GlideAggregate('sc_req_item'); cnt.addQuery('state', 3); cnt.addAggregate('COUNT'); cnt.query();
gs.print('RITM en state=3 hoy: ' + (cnt.next() ? cnt.getAggregate('COUNT') : 0));

// 3) Calendarios
gs.print('\n=== 3) Calendarios candidatos');
var s = new GlideRecord('cmn_schedule');
var q = s.addQuery('name', 'CONTAINS', 'weekday'); q.addOrCondition('name', 'CONTAINS', '8-5'); q.addOrCondition('name', 'CONTAINS', 'habil');
q.addOrCondition('name', 'CONTAINS', 'hábil'); q.addOrCondition('name', 'CONTAINS', 'feriado'); q.addOrCondition('name', 'CONTAINS', 'holiday'); q.addOrCondition('name', 'CONTAINS', 'chile');
s.orderBy('name'); s.query();
var primero = '';
while (s.next()) {
    if (!primero && /8-5 weekdays excluding holidays/i.test(s.getValue('name'))) primero = s.getUniqueValue();
    gs.print('• ' + s.getValue('name') + ' (' + s.getUniqueValue() + ') | tipo: ' + (s.getValue('type') || '-') + ' | zona: ' + (s.getValue('time_zone') || 'flotante'));
    var o = new GlideRecord('cmn_other_schedule'); o.addQuery('schedule', s.getUniqueValue()); o.query();
    while (o.next()) gs.print('     ↳ ' + o.getValue('type') + ': ' + o.getDisplayValue('child_schedule'));
    var sp = new GlideAggregate('cmn_schedule_span'); sp.addQuery('schedule', s.getUniqueValue()); sp.addQuery('start_date_time', '>=', new GlideDateTime().getYearLocalTime() + '0101T000000');
    sp.addAggregate('COUNT'); sp.query();
    gs.print('     tramos/feriados desde el 1 de enero de este año: ' + (sp.next() ? sp.getAggregate('COUNT') : 0));
}
CALENDARIO = CALENDARIO || gs.getProperty('bch.ciber.ritm.cierre.auto.calendario', '') || primero;

// 4) Simulación
gs.print('\n=== 4) Simulación con ' + DIAS + ' días | calendario hábil: ' + CALENDARIO);
var cal = new GlideSchedule(CALENDARIO);
function esHabil(gdt) {
    var dow = gdt.getDayOfWeekLocalTime(); if (dow > 5) return false;   // 6 sáb, 7 dom
    var mediodia = new GlideDateTime(); mediodia.setDisplayValueInternal(gdt.getLocalDate().getValue() + ' 12:00:00');
    return CALENDARIO ? cal.isInSchedule(mediodia) : true;              // feriado = fuera del calendario
}
function sumarHabiles(desde, n) {
    var d = new GlideDateTime(desde), k = 0, guard = 0;
    while (k < n && guard++ < 60) { d.addDaysLocalTime(1); if (esHabil(d)) k++; }
    return d;
}
function fechaTermino(ritm) {
    var a = new GlideRecord('sys_audit'); a.addQuery('tablename', 'sc_req_item'); a.addQuery('documentkey', ritm.getUniqueValue());
    a.addQuery('fieldname', 'state'); a.addQuery('newvalue', '3'); a.orderByDesc('sys_created_on'); a.setLimit(1); a.query();
    if (a.next()) return { f: new GlideDateTime(a.getValue('sys_created_on')), o: 'auditoría' };
    if (ritm.getValue('closed_at')) return { f: new GlideDateTime(ritm.getValue('closed_at')), o: 'closed_at' };
    return { f: new GlideDateTime(ritm.getValue('sys_updated_on')), o: 'sys_updated_on' };
}
var ahora = new GlideDateTime(), c247 = new GlideSchedule('38fa64edc0a8016400f4a5724b0434b8');
var dur = new GlideDuration(60 * 60 * 24 * 1000 * DIAS);
var r = new GlideRecord('sc_req_item'); r.addQuery('state', 3); r.orderBy('sys_updated_on'); r.query();
var tot = 0, contHoy = 0, habHoy = 0, distintos = 0;
while (r.next()) {
    tot++;
    var t = fechaTermino(r), fu = new GlideDateTime(r.getValue('sys_updated_on'));
    var cierreCont = c247.add(fu, dur), cierreHab = sumarHabiles(t.f, DIAS);
    var cc = cierreCont.before(ahora), ch2 = cierreHab.before(ahora);
    if (cc) contHoy++; if (ch2) habHoy++;
    if (cc != ch2 || t.f.getValue().substring(0, 10) != fu.getValue().substring(0, 10)) distintos++;
    if (tot <= MAX_LINEAS) gs.print('• ' + r.getValue('number') + ' | terminado: ' + t.f.getDisplayValue() + ' (' + t.o + ') | actualizado: ' + fu.getDisplayValue() +
        ' | cierre continuo: ' + cierreCont.getDisplayValue() + (cc ? ' ✔' : '') + ' | cierre hábil: ' + cierreHab.getDisplayValue() + (ch2 ? ' ✔' : ''));
}
gs.print('\nTotal Terminados: ' + tot + ' | se cerrarían hoy con lógica actual (continuos): ' + contHoy + ' | con días hábiles: ' + habHoy + ' | con diferencia: ' + distintos);
gs.print('\nFIN (solo lectura)');
