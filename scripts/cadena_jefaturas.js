/*
 * ¿Quién es el divisional de un usuario? — SOLO LECTURA
 * Sube por la cadena de jefaturas (campo manager) desde el usuario y muestra en cada nivel: nombre, cargo (title),
 * departamento y los campos de sys_user relacionados con división / gerencia. Marca como "DIVISIONAL" el primer
 * nivel cuyo cargo contiene "divisional" (o "gerente división"). También sube por el árbol de departamentos (cmn_department).
 * Cuenta: ADMIN | SOLO LECTURA (no modifica nada)
 */
var USUARIO = 'user_previsto_test';   // user_name, o sys_id del previsto (ej. 43a9c5093bc703106977352eb3e45ab0)
var MAX_NIVELES = 10;

// campos extra de sys_user relacionados con división / gerencia
var EXTRA = [];
var d = new GlideRecord('sys_dictionary'); d.addQuery('name', 'sys_user');
var q = d.addQuery('element', 'CONTAINS', 'divis'); q.addOrCondition('element', 'CONTAINS', 'gerenc'); q.addOrCondition('element', 'CONTAINS', 'gerente');
q.addOrCondition('column_label', 'CONTAINS', 'divis'); q.addOrCondition('column_label', 'CONTAINS', 'gerent');
d.query();
while (d.next()) if (EXTRA.indexOf(d.getValue('element')) == -1) EXTRA.push(d.getValue('element'));
gs.print('Campos de sys_user de división / gerencia: ' + (EXTRA.join(', ') || '(ninguno)'));

var u = new GlideRecord('sys_user');
if (!u.get(USUARIO)) { u = new GlideRecord('sys_user'); u.addQuery('user_name', USUARIO); u.query(); u.next(); }
if (!u.isValidRecord()) gs.print('❌ No existe el usuario ' + USUARIO);
else {
    gs.print('\n=== Cadena de jefaturas de ' + u.getValue('name') + ' (' + u.getValue('user_name') + ')');
    var nivel = 0, divisional = null, visto = {};
    while (u.isValidRecord() && nivel <= MAX_NIVELES && !visto[u.getUniqueValue()]) {
        visto[u.getUniqueValue()] = true;
        var cargo = u.getValue('title') || '';
        var extra = EXTRA.map(function (c) { return u.getValue(c) ? c + '=' + u.getDisplayValue(c) : ''; }).filter(function (x) { return x; }).join(' | ');
        var esDiv = /divisional|gerente\s+(de\s+)?divisi/i.test(cargo);
        if (esDiv && !divisional) divisional = nivel;
        gs.print((nivel == 0 ? 'Usuario   ' : 'Nivel ' + nivel + (nivel == 1 ? ' (jefatura directa)' : '') + '  ').substring(0, 30) +
            ' | ' + u.getValue('name') + ' (' + u.getValue('user_name') + ') | cargo: "' + cargo + '" | depto: ' + (u.getDisplayValue('department') || '-') +
            (extra ? ' | ' + extra : '') + (esDiv ? '   ← DIVISIONAL' : '') + (u.getValue('active') == '1' ? '' : ' (inactivo)'));
        if (!u.getValue('manager')) { gs.print('   (sin jefatura más arriba)'); break; }
        var m = new GlideRecord('sys_user'); if (!m.get(u.getValue('manager'))) break;
        u = m; nivel++;
    }
    gs.print(divisional === null ? '\n⚠️ Ningún cargo dice "divisional": revisar los cargos de la cadena o preguntar a BCH qué nivel es.'
        : '\n✅ Divisional = nivel ' + divisional + ' → en el Flow sería requested_for' + new Array(divisional + 1).join('.manager'));

    // árbol de departamentos
    var u0 = new GlideRecord('sys_user'); if (!u0.get(USUARIO)) { u0.addQuery('user_name', USUARIO); u0.query(); u0.next(); }
    if (u0.getValue('department')) {
        gs.print('\n=== Árbol de departamentos');
        var dep = new GlideRecord('cmn_department'), n = 0, vd = {};
        if (dep.get(u0.getValue('department'))) {
            while (dep.isValidRecord() && n < MAX_NIVELES && !vd[dep.getUniqueValue()]) {
                vd[dep.getUniqueValue()] = true;
                gs.print('   ' + new Array(n + 1).join('  ') + '• ' + dep.getValue('name') + ' | jefe: ' + (dep.getDisplayValue('dept_head') || '-'));
                if (!dep.getValue('parent')) break;
                var p = new GlideRecord('cmn_department'); if (!p.get(dep.getValue('parent'))) break;
                dep = p; n++;
            }
        }
    }
}
gs.print('\nFIN (solo lectura)');
