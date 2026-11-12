## Qué cambia

<!-- Una o dos frases. Enlaza el issue: Closes #N -->

## Por qué

<!-- El problema o la necesidad. Si hubo una decisión importante, enlaza el ADR. -->

## Qué no hice y por qué

<!-- Lo que se consideró y se dejó fuera a propósito: alternativas descartadas,
     sobrediseño evitado, deuda aceptada. Para cada punto: qué lo haría necesario. -->

## Riesgos y cómo revertir

<!-- Qué puede salir mal en producción y cómo se deshace: revertir el PR,
     migración `down`, feature flag. "Sin riesgo" también es una respuesta válida si se justifica. -->

## Cómo probarlo

<!-- Pasos concretos: comandos, endpoints, usuarios de prueba. -->

## Checklist

- [ ] SPEC actualizado o no aplica
- [ ] ADR para decisiones de arquitectura o no aplica
- [ ] Pruebas en este mismo PR: unitarias para la lógica nueva, e2e si cambia un endpoint
- [ ] Migración reversible (`down`) si toca la base
- [ ] Sin secretos ni datos reales en el código
