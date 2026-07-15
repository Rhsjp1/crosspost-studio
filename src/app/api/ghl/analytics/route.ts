import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GHL analytics — aggregate stats across all modules
export async function GET() {
  try {
    const [
      totalContacts,
      activeContacts,
      totalOpportunities,
      openDeals,
      wonDeals,
      revenue,
      totalTasks,
      pendingTasks,
      totalEvents,
      upcomingEvents,
      totalSms,
      totalCalls,
      missedCalls,
      totalPayments,
      pendingPayments,
      totalInvoices,
      overdueInvoices,
      avgRating,
      totalReviews,
      activeAutomations,
    ] = await Promise.all([
      db.ghlContact.count(),
      db.ghlContact.count({ where: { status: "active" } }),
      db.ghlOpportunity.count(),
      db.ghlOpportunity.count({ where: { status: "open" } }),
      db.ghlOpportunity.count({ where: { status: "won" } }),
      db.ghlPayment.aggregate({ where: { status: "completed" }, _sum: { amount: true } }),
      db.ghlTask.count(),
      db.ghlTask.count({ where: { status: "pending" } }),
      db.ghlCalendarEvent.count(),
      db.ghlCalendarEvent.count({ where: { status: "scheduled", startTime: { gte: new Date() } } }),
      db.ghlSmsLog.count(),
      db.ghlCallLog.count(),
      db.ghlCallLog.count({ where: { status: "missed" } }),
      db.ghlPayment.count(),
      db.ghlPayment.count({ where: { status: "pending" } }),
      db.ghlInvoice.count(),
      db.ghlInvoice.count({ where: { status: "overdue" } }),
      db.ghlReview.aggregate({ _avg: { rating: true } }),
      db.ghlReview.count(),
      db.ghlAutomation.count({ where: { status: "active" } }),
    ]);

    return NextResponse.json({
      contacts: { total: totalContacts, active: activeContacts },
      opportunities: { total: totalOpportunities, open: openDeals, won: wonDeals },
      revenue: revenue._sum.amount || 0,
      tasks: { total: totalTasks, pending: pendingTasks },
      calendar: { total: totalEvents, upcoming: upcomingEvents },
      sms: { total: totalSms },
      calls: { total: totalCalls, missed: missedCalls },
      payments: { total: totalPayments, pending: pendingPayments },
      invoices: { total: totalInvoices, overdue: overdueInvoices },
      reviews: { total: totalReviews, avgRating: avgRating._avg.rating || 0 },
      automations: { active: activeAutomations },
    });
  } catch (error) {
    console.error("[ghl-analytics GET]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
