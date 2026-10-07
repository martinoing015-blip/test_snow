/*
 * Código del paso Script de la Action de Flow Designer "Obtener divisional" (se pega en Workflow Studio, no es Background Script).
 * Input de la Action:  usuario (Referencia → sys_user) = previsto
 * Outputs del paso / de la Action:
 *   divisional (Cadena en el paso; Referencia → sys_user en la Action) = aprobador
 *   encontrado (Verdadero/Falso) = hay aprobador
 *   origen     (Cadena) = 'divisional' | 'jefe' (no se encontró divisional → jefatura directa) | 'ninguno' (sin jefatura)
 * Lógica: sube por manager hasta el primer miembro del grupo "Divisionales". Si no lo encuentra, devuelve la jefatura directa.
 * En el Flow: si origen = 'jefe' → nota de trabajo; si encontrado = false → grupo de respaldo.
 */
(function execute(inputs, outputs) {
    outputs.divisional = ''; outputs.origen = 'ninguno';
    var g = new GlideRecord('sys_user_group'), gid = g.get('name', 'Divisionales') ? g.getUniqueValue() : '';
    var u = new GlideRecord('sys_user');
    if (u.get(inputs.usuario)) {
        var jefe = u.getValue('manager'), actual = jefe, visto = {};
        for (var i = 0; gid && actual && i < 15 && !visto[actual]; i++) {
            visto[actual] = true;
            var m = new GlideRecord('sys_user_grmember');
            m.addQuery('group', gid); m.addQuery('user', actual); m.setLimit(1); m.query();
            if (m.hasNext()) { outputs.divisional = actual; outputs.origen = 'divisional'; break; }
            var s = new GlideRecord('sys_user');
            if (!s.get(actual)) break;
            actual = s.getValue('manager');
        }
        if (!outputs.divisional && jefe) { outputs.divisional = jefe; outputs.origen = 'jefe'; }
    }
    outputs.encontrado = !!outputs.divisional;
})(inputs, outputs);
