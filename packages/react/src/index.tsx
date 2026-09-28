import {
  Fragment,
  Profiler,
  useCallback,
  useRef,
  type ProfilerOnRenderCallback,
  type ReactNode,
} from 'react';
import { recordReactRender } from '@tracelens/browser';
import type { ReactRenderPayload } from '@tracelens/protocol';

export interface TraceLensProfilerProps {
  children: ReactNode;
  name?: string;
  disabled?: boolean;
}

export interface TraceBoundaryProps {
  children: ReactNode;
  name: string;
  disabled?: boolean;
}

export interface ProfilerSampleInput {
  component: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  renderCount: number;
}

export function createReactRenderSample(
  input: ProfilerSampleInput,
): Omit<ReactRenderPayload, 'interactionId'> {
  return {
    component: input.component,
    phase: input.phase === 'mount' ? 'mount' : 'update',
    duration: input.actualDuration,
    baseDuration: input.baseDuration,
    startTime: input.startTime,
    commitTime: input.commitTime,
    renderCount: input.renderCount,
  };
}

export function TraceLensProfiler({
  children,
  name = 'App',
  disabled = false,
}: TraceLensProfilerProps) {
  return (
    <ProfiledRegion name={name} disabled={disabled}>
      {children}
    </ProfiledRegion>
  );
}

export function TraceBoundary({
  children,
  name,
  disabled = false,
}: TraceBoundaryProps) {
  return (
    <ProfiledRegion name={name} disabled={disabled}>
      {children}
    </ProfiledRegion>
  );
}

function ProfiledRegion({
  children,
  name,
  disabled,
}: Required<TraceLensProfilerProps>) {
  const renderCount = useRef(0);
  const onRender = useCallback<ProfilerOnRenderCallback>(
    (component, phase, actualDuration, baseDuration, startTime, commitTime) => {
      renderCount.current += 1;
      recordReactRender(
        createReactRenderSample({
          component,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
          renderCount: renderCount.current,
        }),
      );
    },
    [],
  );

  if (disabled) return <Fragment>{children}</Fragment>;
  return (
    <Profiler id={name} onRender={onRender}>
      {children}
    </Profiler>
  );
}
