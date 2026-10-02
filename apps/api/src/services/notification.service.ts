import { Resend } from 'resend';
import { db, notifications } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { env } from '../config/env.js';
import { GeneratedReport, Recommendation } from '@serp-scout/types';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface SendReportNotificationParams {
  workspaceId: string;
  businessId: string;
  businessName: string;
  reportId: string;
  recipientEmail: string;
  report: GeneratedReport;
}

export interface NotificationResult {
  success: boolean;
  duplicate?: boolean;
  notificationId?: string;
  externalId?: string;
  error?: string;
}

/**
 * Builds responsive, brand-aligned HTML template for the weekly executive report.
 */
function buildReportEmailHtml(params: {
  businessName: string;
  reportId: string;
  report: GeneratedReport;
}): string {
  const { businessName, reportId, report } = params;
  const reportUrl = `${env.FRONTEND_URL}/reports`;

  const actionsHtml = report.actionPlan
    .map(
      (action: Recommendation, idx: number) => `
    <div style="margin-bottom: 16px; padding: 16px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid ${
      action.priority === 'P0' ? '#ef4444' : action.priority === 'P1' ? '#f59e0b' : '#3b82f6'
    };">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong style="color: #0f172a; font-size: 15px;">#${idx + 1} ${action.title}</strong>
        <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; background: #e2e8f0; color: #334155;">
          ${action.priority} • ${action.expectedImpact.toUpperCase()} IMPACT
        </span>
      </div>
      <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; line-height: 1.5;">
        ${action.problem}
      </p>
      <div style="font-size: 12px; color: #64748b;">
        <strong>Expected outcome:</strong> ${action.expectedImpact}
      </div>
    </div>
  `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Intelligence Report - ${businessName}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 16px;">
    <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      
      <!-- Brand Header -->
      <div style="background-color: #1e1b4b; padding: 28px 24px; text-align: left;">
        <span style="font-size: 11px; font-weight: bold; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px;">
          Serp-Scout Competitive Intelligence
        </span>
        <h1 style="color: #ffffff; font-size: 22px; margin: 8px 0 4px 0; font-weight: 700;">
          Weekly Briefing: ${businessName}
        </h1>
        <p style="color: #c7d2fe; font-size: 13px; margin: 0;">
          Success is measured by real business outcomes rather than a "visibility score."
        </p>
      </div>

      <!-- Content Body -->
      <div style="padding: 24px;">
        
        <!-- Executive Summary Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <h2 style="font-size: 14px; text-transform: uppercase; color: #4338ca; margin: 0 0 12px 0; letter-spacing: 0.5px;">
            Executive Summary
          </h2>
          <div style="margin-bottom: 10px;">
            <strong style="color: #1e293b; font-size: 13px;">🎯 Weekly Focus:</strong>
            <p style="margin: 2px 0 0 0; color: #475569; font-size: 13px;">
              ${report.executiveSummary.weeklyFocus}
            </p>
          </div>
          <div style="margin-bottom: 10px;">
            <strong style="color: #047857; font-size: 13px;">💡 Main Opportunity:</strong>
            <p style="margin: 2px 0 0 0; color: #475569; font-size: 13px;">
              ${report.executiveSummary.mainOpportunity}
            </p>
          </div>
          <div>
            <strong style="color: #b91c1c; font-size: 13px;">⚠️ Competitive Threat:</strong>
            <p style="margin: 2px 0 0 0; color: #475569; font-size: 13px;">
              ${report.executiveSummary.mainCompetitiveThreat}
            </p>
          </div>
        </div>

        <!-- Action Plan -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 16px; color: #0f172a; margin: 0 0 14px 0;">
            Prioritized Action Plan (${report.actionPlan.length} Actions)
          </h2>
          ${actionsHtml}
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0 16px 0;">
          <a href="${reportUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Open Reports & Action Plan →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
        Sent automatically by Serp-Scout for ${businessName}. You can manage refresh frequency in Workspace Settings.
      </div>
    </div>
  </body>
  </html>
  `;
}

export class NotificationService {
  /**
   * Sends transactional email notification for a completed report.
   * Enforces deduplication: exactly ONE notification per reportId!
   */
  static async sendWeeklyReportNotification(
    params: SendReportNotificationParams
  ): Promise<NotificationResult> {
    const { workspaceId, businessId, businessName, reportId, recipientEmail, report } = params;

    // 1. DEDUPLICATION CHECK: ensure only one notification per completed report
    const [existingNotification] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.reportId, reportId),
          eq(notifications.type, 'report_ready')
        )
      )
      .limit(1);

    if (existingNotification) {
      console.log(`[NotificationService] Report notification already recorded (status: ${existingNotification.status}) for report ${reportId}. Skipping to avoid duplicate.`);
      return {
        success: existingNotification.status === 'sent',
        duplicate: true,
        notificationId: existingNotification.id,
        externalId: existingNotification.externalId || undefined,
      };
    }

    const subject = `[Weekly Briefing] ${businessName} — Action Plan & Visibility Changes`;
    const htmlBody = buildReportEmailHtml({ businessName, reportId, report });

    let status = 'sent';
    let externalId: string | null = null;
    let errorMessage: string | null = null;

    // 2. Dispatch via Resend
    if (resend) {
      try {
        // Resend blocks sending to dummy domains like @example.com in test mode.
        // Map @example.com to Resend's official deliverable test address 'delivered@resend.dev'.
        const targetEmail = recipientEmail.endsWith('@example.com')
          ? 'delivered@resend.dev'
          : recipientEmail;

        console.log(`[NotificationService] Dispatching email via Resend to ${targetEmail} (original: ${recipientEmail})...`);
        
        // Note: In development / unverified Resend domains, Resend requires onboarding@resend.dev
        const fromAddress = env.EMAIL_FROM && !env.EMAIL_FROM.endsWith('@serp-scout.app')
          ? env.EMAIL_FROM
          : 'onboarding@resend.dev';
        
        const response = await resend.emails.send({
          from: fromAddress,
          to: targetEmail,
          subject,
          html: htmlBody,
        });

        if (response.error) {
          console.warn(`[NotificationService] Resend API error: ${response.error.message}`);
          // On free-tier Resend, sending to arbitrary emails is restricted unless verified domain is used
          status = 'failed';
          errorMessage = response.error.message;
        } else if (response.data) {
          externalId = response.data.id;
          console.log(`[NotificationService] Resend email dispatched successfully! ID: ${externalId}`);
        }
      } catch (err: any) {
        console.warn(`[NotificationService] Failed to dispatch via Resend: ${err.message}`);
        status = 'failed';
        errorMessage = err.message;
      }
    } else {
      console.log(`[NotificationService] RESEND_API_KEY not configured. Recording simulated notification.`);
      externalId = `sim_${Date.now()}`;
    }

    // 3. Persist notification record in database
    const [inserted] = await db
      .insert(notifications)
      .values({
        workspaceId,
        reportId,
        businessId,
        type: 'report_ready',
        channel: 'email',
        recipient: recipientEmail,
        subject,
        body: htmlBody.substring(0, 5000), // snippet for auditing
        status,
        externalId,
        sentAt: new Date(),
      })
      .returning();

    return {
      success: status === 'sent',
      notificationId: inserted.id,
      externalId: externalId || undefined,
      error: errorMessage || undefined,
    };
  }

  /**
   * Dispatches emergency market shift alert notification.
   */
  static async sendMarketAlertNotification(params: {
    workspaceId: string;
    businessId: string;
    businessName: string;
    alertTitle: string;
    alertDescription: string;
    severity: string;
    recipientEmail: string;
  }): Promise<NotificationResult> {
    const { workspaceId, businessId, businessName, alertTitle, alertDescription, severity, recipientEmail } = params;
    const subject = `🚨 [EMERGENCY ALERT] ${businessName}: ${alertTitle}`;

    // DEDUPLICATION CHECK: ensure only one notification per alert title per business
    const [existingNotification] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.businessId, businessId),
          eq(notifications.type, 'alert'),
          eq(notifications.subject, subject)
        )
      )
      .limit(1);

    if (existingNotification) {
      console.log(`[NotificationService] Alert notification already recorded (status: ${existingNotification.status}) for "${alertTitle}". Skipping duplicate.`);
      return {
        success: existingNotification.status === 'sent',
        duplicate: true,
        notificationId: existingNotification.id,
        externalId: existingNotification.externalId || undefined,
      };
    }

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
        <div style="background: #fee2e2; border: 1px solid #f87171; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="display: inline-block; background: #dc2626; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; text-transform: uppercase;">
              ${severity.toUpperCase()} ALERT
            </span>
            <span style="font-size: 13px; font-weight: 600; color: #991b1b;">Immediate Market Action Recommended</span>
          </div>
          <h2 style="margin: 0 0 10px 0; color: #7f1d1d; font-size: 18px;">${alertTitle}</h2>
          <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.5;">${alertDescription}</p>
        </div>

        <p style="font-size: 13px; color: #64748b;">
          An out-of-cycle market shift was detected for <strong>${businessName}</strong>. Log in to your dashboard to review action items and restore your search visibility.
        </p>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${env.FRONTEND_URL}/reports" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; text-decoration: none;">
            View Executive Report & Actions
          </a>
        </div>
      </div>
    `;

    let status: 'sent' | 'failed' = 'sent';
    let externalId: string | null = null;
    let errorMessage: string | null = null;

    if (resend) {
      try {
        const targetEmail = recipientEmail.endsWith('@example.com')
          ? 'delivered@resend.dev'
          : recipientEmail;
        const fromAddress = env.EMAIL_FROM && !env.EMAIL_FROM.endsWith('@serp-scout.app')
          ? env.EMAIL_FROM
          : 'onboarding@resend.dev';

        const res = await resend.emails.send({
          from: fromAddress,
          to: targetEmail,
          subject,
          html: htmlBody,
        });

        if (res.error) {
          status = 'failed';
          errorMessage = res.error.message;
        } else if (res.data) {
          externalId = res.data.id;
        }
      } catch (err: any) {
        status = 'failed';
        errorMessage = err.message;
      }
    } else {
      externalId = `sim_alert_${Date.now()}`;
    }

    const [inserted] = await db
      .insert(notifications)
      .values({
        workspaceId,
        businessId,
        type: 'alert',
        channel: 'email',
        recipient: recipientEmail,
        subject,
        body: htmlBody.substring(0, 5000),
        status,
        externalId,
        sentAt: new Date(),
      })
      .returning();

    return {
      success: status === 'sent',
      notificationId: inserted.id,
      externalId: externalId || undefined,
      error: errorMessage || undefined,
    };
  }
}
