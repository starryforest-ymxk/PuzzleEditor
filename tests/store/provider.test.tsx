import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StoreProvider } from '../../store/StoreProvider';
import { useProjectSession } from '../../store/context';
import type { ProjectSession } from '../../services/projectSession';

describe('会话实例接线', () => {
    it('同一 Provider 的消费者共享协调器，不同 Provider 相互独立', () => {
        const sessions: ProjectSession[] = [];
        function Probe() { sessions.push(useProjectSession()); return null; }
        renderToStaticMarkup(createElement(Fragment, null,
            createElement(StoreProvider, null, createElement(Probe), createElement(Probe)),
            createElement(StoreProvider, null, createElement(Probe))));
        expect(sessions[0]).toBe(sessions[1]);
        expect(sessions[0]).not.toBe(sessions[2]);
    });
});
