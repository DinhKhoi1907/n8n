import {
	LICENSE_QUOTAS,
	UNLIMITED_LICENSE_QUOTA,
	type NumericLicenseFeature,
} from '@n8n/constants';

import type { FeatureReturnType } from './types';

export const DEV_LICENSE_OVERRIDE_ENV = 'N8N_DEV_LICENSE_OVERRIDE';
export const DEV_LICENSE_PLAN_NAME = 'Developer Override';
export const DEV_LICENSE_AI_CREDITS = 1_000_000;
export const DEV_LICENSE_INSIGHTS_MAX_HISTORY_DAYS = 3650;
export const DEV_LICENSE_INSIGHTS_RETENTION_MAX_AGE_DAYS = 3650;
export const DEV_LICENSE_INSIGHTS_RETENTION_PRUNE_INTERVAL_DAYS = 1;

const DEV_LICENSE_NUMERIC_OVERRIDES: Record<NumericLicenseFeature, number> = {
	[LICENSE_QUOTAS.TRIGGER_LIMIT]: UNLIMITED_LICENSE_QUOTA,
	[LICENSE_QUOTAS.VARIABLES_LIMIT]: UNLIMITED_LICENSE_QUOTA,
	[LICENSE_QUOTAS.USERS_LIMIT]: UNLIMITED_LICENSE_QUOTA,
	[LICENSE_QUOTAS.WORKFLOW_HISTORY_PRUNE_LIMIT]: UNLIMITED_LICENSE_QUOTA,
	[LICENSE_QUOTAS.TEAM_PROJECT_LIMIT]: UNLIMITED_LICENSE_QUOTA,
	[LICENSE_QUOTAS.AI_CREDITS]: DEV_LICENSE_AI_CREDITS,
	[LICENSE_QUOTAS.INSIGHTS_MAX_HISTORY_DAYS]: DEV_LICENSE_INSIGHTS_MAX_HISTORY_DAYS,
	[LICENSE_QUOTAS.INSIGHTS_RETENTION_MAX_AGE_DAYS]: DEV_LICENSE_INSIGHTS_RETENTION_MAX_AGE_DAYS,
	[LICENSE_QUOTAS.INSIGHTS_RETENTION_PRUNE_INTERVAL_DAYS]:
		DEV_LICENSE_INSIGHTS_RETENTION_PRUNE_INTERVAL_DAYS,
	[LICENSE_QUOTAS.WORKFLOWS_WITH_EVALUATION_LIMIT]: UNLIMITED_LICENSE_QUOTA,
};

export function isDevLicenseOverrideEnabled() {
	const value = process.env[DEV_LICENSE_OVERRIDE_ENV]?.trim().toLowerCase();
	return value === 'true' || value === '1';
}

export function getDevLicenseOverrideValue<T extends keyof FeatureReturnType>(
	feature: T,
): FeatureReturnType[T] | undefined {
	if (!isDevLicenseOverrideEnabled()) return undefined;

	if (feature === 'planName') {
		return DEV_LICENSE_PLAN_NAME as FeatureReturnType[T];
	}

	const numericOverride = DEV_LICENSE_NUMERIC_OVERRIDES[feature as NumericLicenseFeature];
	if (numericOverride !== undefined) {
		return numericOverride as FeatureReturnType[T];
	}

	return true as FeatureReturnType[T];
}
