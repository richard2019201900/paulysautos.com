/**
 * ============================================================================
 * UI REPORTS - Elite reports system
 * ============================================================================
 * 
 * CONTENTS:
 * - Reports modal
 * - Report tab switching
 * - Overview report
 * - Income analysis report
 * - Occupancy report
 * - Payment history report
 * - Report data export
 * 
 * DEPENDENCIES: TierService, PropertyDataService
 * ============================================================================
 */

// ============================================
// ELITE REPORTS SYSTEM
// ============================================

window.openReportsModal = async function() {
    // Use OWNED properties for reports (not all viewable)
    const ownedProps = getOwnedProperties();
    if (ownedProps.length === 0) {
        showToast('No properties owned by this account to generate reports for', 'error');
        return;
    }
    
    // Show loading modal first
    const loadingHTML = `
        <div id="reportsModal" class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-2xl p-8 text-center">
                <div class="text-4xl mb-4 animate-pulse">📊</div>
                <p class="text-white font-bold">Loading Elite Portfolio Reports...</p>
                <p class="text-gray-400 text-sm mt-2">Fetching payment data from database</p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
    
    try {
        // Fetch actual payment data from Firestore for all properties
        const reportData = await generateReportDataAsync(ownedProps);
        
        // Remove loading modal
        document.getElementById('reportsModal')?.remove();
        
        // Show the full reports modal
        renderReportsModal(reportData);
    } catch (error) {
        console.error('[EliteReports] Error:', error);
        document.getElementById('reportsModal')?.remove();
        showToast('Error loading reports: ' + error.message, 'error');
    }
};

function renderReportsModal(reportData) {
    
    const modalHTML = `
        <div id="reportsModal" class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onclick="if(event.target.id === 'reportsModal') closeReportsModal()">
            <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full my-8 border border-yellow-500/30" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="bg-gradient-to-r from-yellow-600 to-amber-700 rounded-t-2xl px-6 py-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">📊</span>
                        <div>
                            <h2 class="text-xl font-bold text-white">Elite Portfolio Reports</h2>
                            <p class="text-yellow-200 text-sm">Analyze your rental performance</p>
                        </div>
                    </div>
                    <button onclick="closeReportsModal()" class="text-white/80 hover:text-white transition text-2xl">&times;</button>
                </div>
                
                <!-- Report Tabs -->
                <div class="border-b border-gray-700 px-6 pt-2">
                    <div class="flex gap-2 flex-wrap">
                        <button id="reportTab-overview" onclick="switchReportTab('overview')" class="px-4 py-2 text-sm font-medium rounded-t-lg bg-gray-800 text-yellow-400 border border-gray-600 border-b-0 -mb-px relative z-10">
                            📈 Overview
                        </button>
                        <button id="reportTab-revenue" onclick="switchReportTab('revenue')" class="px-4 py-2 text-sm font-medium rounded-t-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition">
                            💰 Revenue
                        </button>
                        <button id="reportTab-renters" onclick="switchReportTab('renters')" class="px-4 py-2 text-sm font-medium rounded-t-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition">
                            👥 Renter Earnings
                        </button>
                        <button id="reportTab-occupancy" onclick="switchReportTab('occupancy')" class="px-4 py-2 text-sm font-medium rounded-t-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition">
                            🏠 Occupancy
                        </button>
                        <button id="reportTab-performance" onclick="switchReportTab('performance')" class="px-4 py-2 text-sm font-medium rounded-t-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition">
                            🏆 Top Performers
                        </button>
                    </div>
                </div>
                
                <!-- Report Content -->
                <div class="p-6 max-h-[60vh] overflow-y-auto">
                    <!-- Overview Tab -->
                    <div id="reportContent-overview" class="report-tab-content">
                        ${renderOverviewReport(reportData)}
                    </div>
                    
                    <!-- Revenue Tab -->
                    <div id="reportContent-revenue" class="report-tab-content hidden">
                        ${renderRevenueReport(reportData)}
                    </div>
                    
                    <!-- Renter Earnings Tab -->
                    <div id="reportContent-renters" class="report-tab-content hidden">
                        ${renderRenterEarningsReport(reportData)}
                    </div>
                    
                    <!-- Occupancy Tab -->
                    <div id="reportContent-occupancy" class="report-tab-content hidden">
                        ${renderOccupancyReport(reportData)}
                    </div>
                    
                    <!-- Performance Tab -->
                    <div id="reportContent-performance" class="report-tab-content hidden">
                        ${renderPerformanceReport(reportData)}
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="border-t border-gray-700 px-6 py-4 flex justify-between items-center">
                    <p class="text-gray-500 text-xs">👑 Elite Member Exclusive Feature</p>
                    <button onclick="closeReportsModal()" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closeReportsModal = function() {
    const modal = document.getElementById('reportsModal');
    if (modal) modal.remove();
};

window.switchReportTab = function(tabName) {
    // Update tab buttons - remove active styling from all
    document.querySelectorAll('[id^="reportTab-"]').forEach(btn => {
        btn.classList.remove('bg-gray-800', 'text-yellow-400', 'border', 'border-gray-600', 'border-b-0', '-mb-px', 'relative', 'z-10');
        btn.classList.add('text-gray-400');
    });
    
    // Add active styling to selected tab
    const activeTab = document.getElementById(`reportTab-${tabName}`);
    if (activeTab) {
        activeTab.classList.remove('text-gray-400');
        activeTab.classList.add('bg-gray-800', 'text-yellow-400', 'border', 'border-gray-600', 'border-b-0', '-mb-px', 'relative', 'z-10');
    }
    
    // Update content
    document.querySelectorAll('.report-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const activeContent = document.getElementById(`reportContent-${tabName}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
};

/**
 * Generate report data by fetching ACTUAL payment history from Firestore
 * This ensures reports reflect real collected payments, not just prices
 */
async function generateReportDataAsync(properties) {
    const now = new Date();
    const data = {
        totalProperties: properties.length,
        rentedProperties: 0,
        availableProperties: 0,
        totalWeeklyRevenue: 0,
        totalMonthlyRevenue: 0,
        totalPaymentsReceived: 0,
        totalPaymentAmount: 0,
        propertyStats: [],
        revenueByType: {},
        revenueByFrequency: { daily: 0, weekly: 0, biweekly: 0, monthly: 0 },
        frequencyCount: { daily: 0, weekly: 0, biweekly: 0, monthly: 0 },
        renterEarnings: {}, // NEW: Track actual earnings per renter
        tenureHistory: [],   // NEW: All completed tenures
        paymentHistory: []
    };
    
    // Fetch payment history for all properties in parallel
    const paymentPromises = properties.map(async (p) => {
        try {
            const historyDoc = await db.collection('paymentHistory').doc(String(p.id)).get();
            if (historyDoc.exists) {
                const histData = historyDoc.data();
                return {
                    propertyId: p.id,
                    payments: histData.payments || [],
                    tenureHistory: histData.tenureHistory || [],
                    vacancyPeriods: histData.vacancyPeriods || []
                };
            }
        } catch (e) {
            console.warn(`[EliteReports] Could not fetch history for property ${p.id}:`, e);
        }
        return { propertyId: p.id, payments: [], tenureHistory: [], vacancyPeriods: [] };
    });
    
    const allPaymentData = await Promise.all(paymentPromises);
    
    // Create lookup for payment data
    const paymentDataByProperty = {};
    allPaymentData.forEach(pd => {
        paymentDataByProperty[pd.propertyId] = pd;
    });
    
    properties.forEach(p => {
        const isAvailable = state.availability[p.id] !== false;
        const renterName = PropertyDataService.getValue(p.id, 'renterName', p.renterName || '');
        const paymentFrequency = PropertyDataService.getValue(p.id, 'paymentFrequency', p.paymentFrequency || '');
        const lastPaymentDate = PropertyDataService.getValue(p.id, 'lastPaymentDate', p.lastPaymentDate || '');
        const dailyPrice = PropertyDataService.getValue(p.id, 'dailyPrice', p.dailyPrice || 0);
        const weeklyPrice = p.weeklyPrice || 0;
        const monthlyPrice = p.monthlyPrice || 0;
        const biweeklyPrice = PropertyDataService.getValue(p.id, 'biweeklyPrice', p.biweeklyPrice || weeklyPrice * 2);
        
        // Get ACTUAL payment history from Firestore
        const propertyPaymentData = paymentDataByProperty[p.id] || { payments: [], tenureHistory: [] };
        const payments = propertyPaymentData.payments || [];
        const tenures = propertyPaymentData.tenureHistory || [];
        
        // Calculate ACTUAL received amount
        const totalReceived = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
        
        // Track payments by renter for "Renter Earnings" report
        payments.forEach(pay => {
            const rName = pay.renterName || 'Unknown';
            if (!data.renterEarnings[rName]) {
                data.renterEarnings[rName] = {
                    name: rName,
                    totalPaid: 0,
                    paymentCount: 0,
                    properties: new Set(),
                    lastPayment: null
                };
            }
            data.renterEarnings[rName].totalPaid += (pay.amount || 0);
            data.renterEarnings[rName].paymentCount++;
            data.renterEarnings[rName].properties.add(p.title || `Property #${p.id}`);
            
            const payDate = new Date(pay.paymentDate || pay.recordedAt);
            if (!data.renterEarnings[rName].lastPayment || payDate > data.renterEarnings[rName].lastPayment) {
                data.renterEarnings[rName].lastPayment = payDate;
            }
        });
        
        // Add tenure history
        tenures.forEach(t => {
            data.tenureHistory.push({
                ...t,
                propertyName: p.title || `Property #${p.id}`
            });
        });
        
        // Determine rent amount based on frequency (for projections, not actual)
        let rentAmount = 0;
        let monthlyEquivalent = 0;
        if (!isAvailable && renterName) {
            if (paymentFrequency === 'daily') {
                rentAmount = dailyPrice;
                monthlyEquivalent = dailyPrice * 30;
                data.frequencyCount.daily++;
                data.revenueByFrequency.daily += monthlyEquivalent;
            } else if (paymentFrequency === 'weekly') {
                rentAmount = weeklyPrice;
                monthlyEquivalent = weeklyPrice * 4;
                data.frequencyCount.weekly++;
                data.revenueByFrequency.weekly += monthlyEquivalent;
            } else if (paymentFrequency === 'biweekly') {
                rentAmount = biweeklyPrice;
                monthlyEquivalent = biweeklyPrice * 2;
                data.frequencyCount.biweekly++;
                data.revenueByFrequency.biweekly += monthlyEquivalent;
            } else if (paymentFrequency === 'monthly') {
                rentAmount = monthlyPrice;
                monthlyEquivalent = monthlyPrice;
                data.frequencyCount.monthly++;
                data.revenueByFrequency.monthly += monthlyEquivalent;
            }
        }
        
        if (isAvailable) {
            data.availableProperties++;
        } else {
            data.rentedProperties++;
            data.totalWeeklyRevenue += (paymentFrequency === 'weekly' ? rentAmount : 0);
            data.totalMonthlyRevenue += monthlyEquivalent;
        }
        
        data.totalPaymentsReceived += payments.length;
        data.totalPaymentAmount += totalReceived;
        
        // Add all payments to history for timeline
        payments.forEach(pay => {
            data.paymentHistory.push({
                ...pay,
                propertyId: p.id,
                propertyName: p.title || `Property #${p.id}`
            });
        });
        
        // Revenue by property type
        const propType = p.type || 'Other';
        if (!data.revenueByType[propType]) {
            data.revenueByType[propType] = { count: 0, rented: 0, revenue: 0, collected: 0 };
        }
        data.revenueByType[propType].count++;
        data.revenueByType[propType].collected += totalReceived;
        if (!isAvailable) {
            data.revenueByType[propType].rented++;
            data.revenueByType[propType].revenue += monthlyEquivalent;
        }
        
        // Property stats for ranking
        data.propertyStats.push({
            id: p.id,
            name: p.title || `Property #${p.id}`,
            title: p.title || `Property #${p.id}`,
            type: propType,
            isRented: !isAvailable,
            renterName: renterName,
            frequency: paymentFrequency,
            rentAmount: rentAmount,
            monthlyEquivalent: monthlyEquivalent,
            paymentsReceived: payments.length,
            totalReceived: totalReceived,  // ACTUAL collected
            lastPaymentDate: lastPaymentDate
        });
    });
    
    // Sort properties by ACTUAL revenue collected
    data.propertyStats.sort((a, b) => b.totalReceived - a.totalReceived);
    
    // Convert renter earnings to array and sort
    data.renterEarningsList = Object.values(data.renterEarnings)
        .map(r => ({
            ...r,
            properties: Array.from(r.properties)
        }))
        .sort((a, b) => b.totalPaid - a.totalPaid);
    
    // Sort payment history by date
    data.paymentHistory.sort((a, b) => new Date(b.paymentDate || b.recordedAt) - new Date(a.paymentDate || a.recordedAt));
    
    // Calculate occupancy rate
    data.occupancyRate = data.totalProperties > 0 
        ? Math.round((data.rentedProperties / data.totalProperties) * 100) 
        : 0;
    
    return data;
}

function renderOverviewReport(data) {
    const occupancyColor = data.occupancyRate >= 80 ? 'text-green-400' : 
                           data.occupancyRate >= 50 ? 'text-yellow-400' : 'text-red-400';
    
    // Calculate vacancy loss (potential revenue from empty units)
    const avgRentPerUnit = data.rentedProperties > 0 ? data.totalMonthlyRevenue / data.rentedProperties : 0;
    const weeklyVacancyLoss = Math.round((avgRentPerUnit / 4) * data.availableProperties);
    const monthlyVacancyLoss = Math.round(avgRentPerUnit * data.availableProperties);
    
    // Calculate cash flow forecast (next 4 weeks)
    const weeklyIncome = Math.round(data.totalMonthlyRevenue / 4);
    const forecast = [
        { week: 'This Week', amount: weeklyIncome },
        { week: 'Week 2', amount: weeklyIncome },
        { week: 'Week 3', amount: weeklyIncome },
        { week: 'Week 4', amount: weeklyIncome }
    ];
    
    // Find overdue payments (properties with past due dates)
    const now = new Date();
    const overdueProps = data.propertyStats.filter(p => {
        if (!p.isRented || !p.lastPaymentDate) return false;
        const freq = p.frequency || 'weekly';
        const lastPay = new Date(p.lastPaymentDate + 'T00:00:00');
        let dueDate = new Date(lastPay);
        if (freq === 'daily') dueDate.setDate(dueDate.getDate() + 1);
        else if (freq === 'weekly') dueDate.setDate(dueDate.getDate() + 7);
        else if (freq === 'biweekly') dueDate.setDate(dueDate.getDate() + 14);
        else dueDate.setMonth(dueDate.getMonth() + 1);
        return now > dueDate;
    });
    
    // Find upcoming payments (due within 3 days)
    const upcomingProps = data.propertyStats.filter(p => {
        if (!p.isRented || !p.lastPaymentDate) return false;
        const freq = p.frequency || 'weekly';
        const lastPay = new Date(p.lastPaymentDate + 'T00:00:00');
        let dueDate = new Date(lastPay);
        if (freq === 'daily') dueDate.setDate(dueDate.getDate() + 1);
        else if (freq === 'weekly') dueDate.setDate(dueDate.getDate() + 7);
        else if (freq === 'biweekly') dueDate.setDate(dueDate.getDate() + 14);
        else dueDate.setMonth(dueDate.getMonth() + 1);
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 3;
    });
    
    return `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <p class="text-gray-400 text-xs mb-1">Total Properties</p>
                <p class="text-2xl font-bold text-white">${data.totalProperties}</p>
            </div>
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <p class="text-gray-400 text-xs mb-1">Occupancy Rate</p>
                <p class="text-2xl font-bold ${occupancyColor}">${data.occupancyRate}%</p>
            </div>
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <p class="text-gray-400 text-xs mb-1">Monthly Revenue</p>
                <p class="text-2xl font-bold text-green-400">${formatPrice(data.totalMonthlyRevenue)}</p>
            </div>
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <p class="text-gray-400 text-xs mb-1">Total Collected</p>
                <p class="text-2xl font-bold text-purple-400">${formatPrice(data.totalPaymentAmount)}</p>
            </div>
        </div>
        
        <!-- Payment Alerts Section -->
        ${(overdueProps.length > 0 || upcomingProps.length > 0) ? `
            <div class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                ${overdueProps.length > 0 ? `
                    <div class="bg-gradient-to-r from-red-900/30 to-red-800/20 rounded-xl p-4 border border-red-500/30">
                        <h4 class="text-red-400 font-bold mb-3 flex items-center gap-2">
                            🚨 Overdue Payments (${overdueProps.length})
                        </h4>
                        <div class="space-y-2 max-h-32 overflow-y-auto">
                            ${overdueProps.slice(0, 5).map(p => `
                                <div class="flex justify-between items-center text-sm bg-red-900/20 rounded-lg px-3 py-2">
                                    <span class="text-white truncate max-w-[60%]">${p.name}</span>
                                    <span class="text-red-400 font-medium">${p.renterName || 'Tenant'}</span>
                                </div>
                            `).join('')}
                            ${overdueProps.length > 5 ? `<p class="text-red-400/60 text-xs text-center">+${overdueProps.length - 5} more</p>` : ''}
                        </div>
                    </div>
                ` : ''}
                ${upcomingProps.length > 0 ? `
                    <div class="bg-gradient-to-r from-amber-900/30 to-yellow-800/20 rounded-xl p-4 border border-amber-500/30">
                        <h4 class="text-amber-400 font-bold mb-3 flex items-center gap-2">
                            ⏰ Due Soon (${upcomingProps.length})
                        </h4>
                        <div class="space-y-2 max-h-32 overflow-y-auto">
                            ${upcomingProps.slice(0, 5).map(p => `
                                <div class="flex justify-between items-center text-sm bg-amber-900/20 rounded-lg px-3 py-2">
                                    <span class="text-white truncate max-w-[60%]">${p.name}</span>
                                    <span class="text-amber-400 font-medium">${p.renterName || 'Tenant'}</span>
                                </div>
                            `).join('')}
                            ${upcomingProps.length > 5 ? `<p class="text-amber-400/60 text-xs text-center">+${upcomingProps.length - 5} more</p>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        ` : ''}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <!-- Occupancy Chart -->
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <h4 class="text-white font-bold mb-4">📊 Portfolio Status</h4>
                <div class="flex items-center justify-center">
                    <div class="relative w-40 h-40">
                        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke="#374151" stroke-width="12" fill="none"/>
                            <circle cx="50" cy="50" r="40" stroke="#10B981" stroke-width="12" fill="none"
                                stroke-dasharray="${data.occupancyRate * 2.51} 251" stroke-linecap="round"/>
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="text-3xl font-bold text-white">${data.occupancyRate}%</span>
                            <span class="text-xs text-gray-400">Occupied</span>
                        </div>
                    </div>
                </div>
                <div class="flex justify-center gap-6 mt-4 text-sm">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span class="text-gray-300">Rented: ${data.rentedProperties}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 bg-gray-600 rounded-full"></div>
                        <span class="text-gray-300">Available: ${data.availableProperties}</span>
                    </div>
                </div>
            </div>
            
            <!-- Revenue by Type -->
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <h4 class="text-white font-bold mb-4">🏢 Revenue by Property Type</h4>
                <div class="space-y-3">
                    ${Object.entries(data.revenueByType).map(([type, stats]) => {
                        const maxRevenue = Math.max(...Object.values(data.revenueByType).map(s => s.revenue));
                        const width = maxRevenue > 0 ? (stats.revenue / maxRevenue) * 100 : 0;
                        return `
                            <div>
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="text-gray-300">${type}</span>
                                    <span class="text-green-400">${formatPrice(stats.revenue)}/mo</span>
                                </div>
                                <div class="bg-gray-700 rounded-full h-2">
                                    <div class="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full" style="width: ${width}%"></div>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">${stats.rented}/${stats.count} occupied</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        
        <!-- Vacancy Loss & Cash Flow Forecast -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Vacancy Loss Calculator -->
            <div class="bg-gradient-to-br from-red-900/20 to-orange-900/20 rounded-xl p-4 border border-red-500/20">
                <h4 class="text-red-400 font-bold mb-3 flex items-center gap-2">
                    💸 Vacancy Loss Calculator
                </h4>
                ${data.availableProperties > 0 ? `
                    <div class="space-y-3">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400 text-sm">Empty Units:</span>
                            <span class="text-white font-bold">${data.availableProperties}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-400 text-sm">Avg Rent/Unit:</span>
                            <span class="text-white font-bold">${formatPrice(avgRentPerUnit)}/mo</span>
                        </div>
                        <div class="border-t border-gray-700 pt-3">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-300 text-sm">Weekly Loss:</span>
                                <span class="text-red-400 font-bold">-${formatPrice(weeklyVacancyLoss)}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-300 text-sm">Monthly Loss:</span>
                                <span class="text-red-400 font-bold text-lg">-${formatPrice(monthlyVacancyLoss)}</span>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 italic">Fill vacancies to reclaim this income!</p>
                    </div>
                ` : `
                    <div class="text-center py-4">
                        <p class="text-green-400 font-bold">🎉 No Vacancies!</p>
                        <p class="text-gray-400 text-sm">All units generating income</p>
                    </div>
                `}
            </div>
            
            <!-- Cash Flow Forecast -->
            <div class="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 rounded-xl p-4 border border-blue-500/20">
                <h4 class="text-blue-400 font-bold mb-3 flex items-center gap-2">
                    📈 4-Week Cash Flow Forecast
                </h4>
                <div class="space-y-2">
                    ${forecast.map((f, i) => {
                        const width = data.totalMonthlyRevenue > 0 ? (f.amount / (weeklyIncome * 1.2)) * 100 : 0;
                        return `
                            <div class="flex items-center gap-3">
                                <span class="text-gray-400 text-xs w-16">${f.week}</span>
                                <div class="flex-1 bg-gray-700 rounded-full h-4 relative overflow-hidden">
                                    <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" 
                                         style="width: ${Math.min(width, 100)}%"></div>
                                </div>
                                <span class="text-green-400 font-bold text-sm w-20 text-right">+${formatPrice(f.amount)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="border-t border-gray-700 mt-3 pt-3">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300 font-medium">Projected Total:</span>
                        <span class="text-green-400 font-bold text-lg">+${formatPrice(weeklyIncome * 4)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderRevenueReport(data) {
    // Calculate revenue breakdown
    const frequencyBreakdown = {
        daily: { count: 0, revenue: 0 },
        weekly: { count: 0, revenue: 0 },
        biweekly: { count: 0, revenue: 0 },
        monthly: { count: 0, revenue: 0 }
    };
    
    data.propertyStats.filter(p => p.isRented).forEach(p => {
        const freq = p.frequency || 'weekly';
        if (frequencyBreakdown[freq]) {
            frequencyBreakdown[freq].count++;
            frequencyBreakdown[freq].revenue += p.monthlyEquivalent;
        }
    });
    
    return `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gradient-to-br from-green-600/20 to-emerald-700/20 rounded-xl p-4 border border-green-500/30">
                <p class="text-green-300 text-xs mb-1">Projected Monthly</p>
                <p class="text-2xl font-bold text-green-400">${formatPrice(data.totalMonthlyRevenue)}</p>
                <p class="text-green-400/50 text-xs">Based on current rents</p>
            </div>
            <div class="bg-gradient-to-br from-blue-600/20 to-cyan-700/20 rounded-xl p-4 border border-blue-500/30">
                <p class="text-blue-300 text-xs mb-1">Projected Yearly</p>
                <p class="text-2xl font-bold text-blue-400">${formatPrice(data.totalMonthlyRevenue * 12)}</p>
                <p class="text-blue-400/50 text-xs">Based on current rents</p>
            </div>
            <div class="bg-gradient-to-br from-purple-600/20 to-pink-700/20 rounded-xl p-4 border border-purple-500/30">
                <p class="text-purple-300 text-xs mb-1">Payments Logged</p>
                <p class="text-2xl font-bold text-purple-400">${data.totalPaymentsReceived}</p>
                <p class="text-purple-400/50 text-xs">All-time</p>
            </div>
            <div class="bg-gradient-to-br from-amber-600/20 to-orange-700/20 rounded-xl p-4 border border-amber-500/30">
                <p class="text-amber-300 text-xs mb-1">💰 Actual Collected</p>
                <p class="text-2xl font-bold text-amber-400">${formatPrice(data.totalPaymentAmount)}</p>
                <p class="text-amber-400/50 text-xs">From payment ledger</p>
            </div>
        </div>
        
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-6">
            <h4 class="text-white font-bold mb-4">💵 Revenue by Payment Frequency</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${Object.entries(frequencyBreakdown).map(([freq, stats]) => `
                    <div class="text-center p-3 bg-gray-800 rounded-lg">
                        <p class="text-gray-400 text-xs capitalize mb-1">${freq}</p>
                        <p class="text-lg font-bold text-white">${stats.count}</p>
                        <p class="text-green-400 text-sm">${formatPrice(stats.revenue)}/mo</p>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h4 class="text-white font-bold mb-4">📋 Revenue Breakdown by Property</h4>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-gray-400 border-b border-gray-700">
                            <th class="text-left py-2 px-3">Property</th>
                            <th class="text-left py-2 px-3">Type</th>
                            <th class="text-center py-2 px-3">Frequency</th>
                            <th class="text-right py-2 px-3">Current Rate</th>
                            <th class="text-right py-2 px-3">Actual Collected</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.propertyStats.filter(p => p.isRented || p.totalReceived > 0).map(p => `
                            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                                <td class="py-2 px-3 text-white">${p.name}</td>
                                <td class="py-2 px-3 text-gray-400">${p.type}</td>
                                <td class="py-2 px-3 text-center">
                                    ${p.frequency ? `
                                    <span class="px-2 py-1 rounded text-xs ${
                                        p.frequency === 'daily' ? 'bg-cyan-900/50 text-cyan-300' :
                                        p.frequency === 'weekly' ? 'bg-blue-900/50 text-blue-300' :
                                        p.frequency === 'biweekly' ? 'bg-purple-900/50 text-purple-300' :
                                        'bg-green-900/50 text-green-300'
                                    }">${p.frequency}</span>
                                    ` : '<span class="text-gray-500">-</span>'}
                                </td>
                                <td class="py-2 px-3 text-right text-white">${p.rentAmount > 0 ? formatPrice(p.rentAmount) : '-'}</td>
                                <td class="py-2 px-3 text-right ${p.totalReceived > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}">${p.totalReceived > 0 ? formatPrice(p.totalReceived) : '$0'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderOccupancyReport(data) {
    const rentedProps = data.propertyStats.filter(p => p.isRented);
    const availableProps = data.propertyStats.filter(p => !p.isRented);
    
    return `
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-gradient-to-br from-green-600/20 to-emerald-700/20 rounded-xl p-6 border border-green-500/30 text-center">
                <p class="text-green-300 text-sm mb-2">Rented Units</p>
                <p class="text-5xl font-black text-green-400">${data.rentedProperties}</p>
                <p class="text-green-300 text-xs mt-2">${data.occupancyRate}% of portfolio</p>
            </div>
            <div class="bg-gradient-to-br from-gray-600/20 to-gray-700/20 rounded-xl p-6 border border-gray-500/30 text-center">
                <p class="text-gray-300 text-sm mb-2">Available Units</p>
                <p class="text-5xl font-black text-gray-400">${data.availableProperties}</p>
                <p class="text-gray-400 text-xs mt-2">${100 - data.occupancyRate}% of portfolio</p>
            </div>
        </div>
        
        <!-- Rented Properties -->
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-4">
            <h4 class="text-green-400 font-bold mb-3 flex items-center gap-2">
                <span class="w-3 h-3 bg-green-500 rounded-full"></span>
                Currently Rented (${rentedProps.length})
            </h4>
            ${rentedProps.length > 0 ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${rentedProps.map(p => `
                        <div class="bg-gray-800 rounded-lg px-3 py-2 flex justify-between items-center">
                            <div>
                                <p class="text-white text-sm font-medium">${p.name}</p>
                                <p class="text-gray-400 text-xs">Renter: ${p.renterName || 'Unknown'}</p>
                            </div>
                            <p class="text-green-400 text-sm font-medium">${formatPrice(p.rentAmount)}/${p.frequency.charAt(0)}</p>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-gray-500 text-center py-4">No rented properties</p>'}
        </div>
        
        <!-- Available Properties -->
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h4 class="text-gray-400 font-bold mb-3 flex items-center gap-2">
                <span class="w-3 h-3 bg-gray-500 rounded-full"></span>
                Currently Available (${availableProps.length})
            </h4>
            ${availableProps.length > 0 ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${availableProps.map(p => `
                        <div class="bg-gray-800 rounded-lg px-3 py-2 flex justify-between items-center">
                            <div>
                                <p class="text-white text-sm font-medium">${p.name}</p>
                                <p class="text-gray-400 text-xs">${p.type}</p>
                            </div>
                            <p class="text-amber-400 text-xs">Ready to rent</p>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-green-400 text-center py-4">🎉 All properties are rented!</p>'}
        </div>
    `;
}

/**
 * Render Renter Earnings Report - Shows actual collected amounts per renter
 */
function renderRenterEarningsReport(data) {
    const renterList = data.renterEarningsList || [];
    const totalCollected = renterList.reduce((sum, r) => sum + r.totalPaid, 0);
    const totalPayments = renterList.reduce((sum, r) => sum + r.paymentCount, 0);
    
    return `
        <!-- Summary Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gradient-to-br from-green-600/20 to-emerald-700/20 rounded-xl p-4 border border-green-500/30">
                <p class="text-green-300 text-xs mb-1">Total Collected</p>
                <p class="text-2xl font-bold text-green-400">${formatPrice(totalCollected)}</p>
            </div>
            <div class="bg-gradient-to-br from-blue-600/20 to-cyan-700/20 rounded-xl p-4 border border-blue-500/30">
                <p class="text-blue-300 text-xs mb-1">Total Payments</p>
                <p class="text-2xl font-bold text-blue-400">${totalPayments}</p>
            </div>
            <div class="bg-gradient-to-br from-purple-600/20 to-pink-700/20 rounded-xl p-4 border border-purple-500/30">
                <p class="text-purple-300 text-xs mb-1">Unique Renters</p>
                <p class="text-2xl font-bold text-purple-400">${renterList.length}</p>
            </div>
            <div class="bg-gradient-to-br from-amber-600/20 to-orange-700/20 rounded-xl p-4 border border-amber-500/30">
                <p class="text-amber-300 text-xs mb-1">Avg per Renter</p>
                <p class="text-2xl font-bold text-amber-400">${renterList.length > 0 ? formatPrice(totalCollected / renterList.length) : '$0'}</p>
            </div>
        </div>
        
        <!-- Renter Earnings List -->
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h4 class="text-white font-bold mb-4 flex items-center gap-2">
                👥 Earnings by Renter
                <span class="text-xs font-normal text-gray-400">(sorted by total paid)</span>
            </h4>
            
            ${renterList.length > 0 ? `
                <div class="space-y-3">
                    ${renterList.map((r, i) => {
                        const maxPaid = renterList[0]?.totalPaid || 1;
                        const width = (r.totalPaid / maxPaid) * 100;
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '💰';
                        return `
                            <div class="bg-gray-800 rounded-xl p-4">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center gap-3">
                                        <span class="text-2xl">${medal}</span>
                                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                            ${r.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p class="text-white font-bold">${r.name}</p>
                                            <p class="text-gray-400 text-xs">${r.paymentCount} payment${r.paymentCount !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-2xl font-bold text-green-400">${formatPrice(r.totalPaid)}</p>
                                        ${r.lastPayment ? `<p class="text-gray-500 text-xs">Last: ${r.lastPayment.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>` : ''}
                                    </div>
                                </div>
                                
                                <!-- Progress bar -->
                                <div class="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                                    <div class="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all" style="width: ${width}%"></div>
                                </div>
                                
                                <!-- Properties -->
                                <div class="flex flex-wrap gap-1">
                                    ${r.properties.map(prop => `
                                        <span class="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">${prop}</span>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : `
                <div class="text-center py-8">
                    <div class="text-4xl mb-3">📭</div>
                    <p class="text-gray-400">No payment history yet</p>
                    <p class="text-gray-500 text-sm mt-1">Payments will appear here when renters pay</p>
                </div>
            `}
        </div>
        
        ${data.tenureHistory && data.tenureHistory.length > 0 ? `
        <!-- Completed Tenures -->
        <div class="bg-gray-900 rounded-xl p-4 border border-gray-700 mt-6">
            <h4 class="text-white font-bold mb-4 flex items-center gap-2">
                📜 Completed Tenures
                <span class="text-xs font-normal text-green-400">${data.tenureHistory.length} total</span>
            </h4>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-gray-400 border-b border-gray-700">
                            <th class="text-left py-2 px-3">Renter</th>
                            <th class="text-left py-2 px-3">Property</th>
                            <th class="text-center py-2 px-3">Duration</th>
                            <th class="text-right py-2 px-3">Total Collected</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.tenureHistory.slice(0, 10).map(t => `
                            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                                <td class="py-2 px-3 text-white">${t.renterName || 'Unknown'}</td>
                                <td class="py-2 px-3 text-gray-400">${t.propertyName || 'Unknown'}</td>
                                <td class="py-2 px-3 text-center text-gray-400">${t.tenureDays || 0} days</td>
                                <td class="py-2 px-3 text-right text-green-400 font-bold">${formatPrice(t.totalCollected || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
    `;
}

function renderPerformanceReport(data) {
    const topByRevenue = [...data.propertyStats].filter(p => p.isRented).sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent).slice(0, 5);
    const topByPayments = [...data.propertyStats].filter(p => p.totalReceived > 0).sort((a, b) => b.totalReceived - a.totalReceived).slice(0, 5);
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Top by Current Revenue -->
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <h4 class="text-white font-bold mb-4 flex items-center gap-2">
                    🏆 Top Earners (Current Rent)
                </h4>
                ${topByRevenue.length > 0 ? `
                    <div class="space-y-3">
                        ${topByRevenue.map((p, i) => {
                            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                            const maxRev = topByRevenue[0]?.monthlyEquivalent || 1;
                            const width = (p.monthlyEquivalent / maxRev) * 100;
                            return `
                                <div class="relative">
                                    <div class="flex items-center gap-3 mb-1">
                                        <span class="text-lg">${medals[i]}</span>
                                        <span class="text-white text-sm font-medium flex-1">${p.name}</span>
                                        <span class="text-green-400 font-bold">${formatPrice(p.monthlyEquivalent)}/mo</span>
                                    </div>
                                    <div class="bg-gray-700 rounded-full h-1.5 ml-8">
                                        <div class="bg-gradient-to-r from-yellow-500 to-amber-400 h-1.5 rounded-full transition-all" style="width: ${width}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<p class="text-gray-500 text-center py-4">No rented properties yet</p>'}
            </div>
            
            <!-- Top by Total Collected -->
            <div class="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <h4 class="text-white font-bold mb-4 flex items-center gap-2">
                    💎 Top Earners (All-Time Collected)
                </h4>
                ${topByPayments.length > 0 ? `
                    <div class="space-y-3">
                        ${topByPayments.map((p, i) => {
                            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                            const maxPay = topByPayments[0]?.totalReceived || 1;
                            const width = (p.totalReceived / maxPay) * 100;
                            return `
                                <div class="relative">
                                    <div class="flex items-center gap-3 mb-1">
                                        <span class="text-lg">${medals[i]}</span>
                                        <span class="text-white text-sm font-medium flex-1">${p.name}</span>
                                        <span class="text-purple-400 font-bold">${formatPrice(p.totalReceived)}</span>
                                    </div>
                                    <div class="bg-gray-700 rounded-full h-1.5 ml-8">
                                        <div class="bg-gradient-to-r from-purple-500 to-pink-400 h-1.5 rounded-full transition-all" style="width: ${width}%"></div>
                                    </div>
                                    <p class="text-xs text-gray-500 ml-8">${p.paymentsReceived} payments logged</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<p class="text-gray-500 text-center py-4">No payments logged yet</p>'}
            </div>
        </div>
        
        <!-- Performance Insights -->
        <div class="bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border border-yellow-500/30 rounded-xl p-4 mt-6">
            <h4 class="text-yellow-400 font-bold mb-3">💡 Performance Insights</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div class="bg-gray-900/50 rounded-lg p-3">
                    <p class="text-gray-400 mb-1">Avg Rent per Unit</p>
                    <p class="text-white font-bold">${data.rentedProperties > 0 ? formatPrice(data.totalMonthlyRevenue / data.rentedProperties) : '$0'}/mo</p>
                </div>
                <div class="bg-gray-900/50 rounded-lg p-3">
                    <p class="text-gray-400 mb-1">Portfolio Value</p>
                    <p class="text-white font-bold">${formatPrice(data.totalMonthlyRevenue * 12)}/yr</p>
                </div>
                <div class="bg-gray-900/50 rounded-lg p-3">
                    <p class="text-gray-400 mb-1">Vacancy Loss</p>
                    <p class="text-red-400 font-bold">${data.availableProperties} units idle</p>
                </div>
            </div>
        </div>
    `;
}

// ==================== ELITE REPORTS SYSTEM ====================

// Show/hide Elite Reports button based on tier
function updateEliteReportsButton() {
    const btn = document.getElementById('eliteReportsBtn');
    if (!btn) return;
    
    const user = auth.currentUser;
    if (!user) {
        btn.classList.add('hidden');
        btn.classList.remove('flex');
        return;
    }
    
    // Master admin (owner) always gets access
    if (TierService.isMasterAdmin(user.email)) {
        btn.classList.remove('hidden');
        btn.classList.add('flex');
        return;
    }
    
    // Quick check from cached state first
    if (state.ownerData?.tier === 'elite') {
        btn.classList.remove('hidden');
        btn.classList.add('flex');
        return;
    }
    
    // Check Firestore for user tier
    db.collection('users').where('email', '==', user.email.toLowerCase()).get()
        .then(snapshot => {
            if (!snapshot.empty) {
                const userData = snapshot.docs[0].data();
                if (userData.tier === 'elite') {
                    btn.classList.remove('hidden');
                    btn.classList.add('flex');
                } else {
                    btn.classList.add('hidden');
                    btn.classList.remove('flex');
                }
            }
        })
        .catch(() => {
            // Silently fail - button just won't show
        });
}

// ==================== ADDITIONAL REPORT HELPERS ====================
// These are used by the dynamically generated reports modal
async function generateOverviewReport() {
    const content = document.getElementById('reportContent');
    const ownerProps = getOwnedProperties();
    
    // Calculate stats
    let totalWeeklyIncome = 0;
    let totalMonthlyIncome = 0;
    let occupiedCount = 0;
    let totalPaymentsLogged = 0;
    let totalRevenueCollected = 0;
    
    // Gather all payment data
    const paymentPromises = ownerProps.map(p => getPaymentHistory(p.id));
    const allPayments = await Promise.all(paymentPromises);
    
    ownerProps.forEach((p, idx) => {
        const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
        const monthlyPrice = PropertyDataService.getValue(p.id, 'monthlyPrice', p.monthlyPrice || weeklyPrice * 4);
        const isOccupied = state.availability[p.id] === false;
        
        if (isOccupied) {
            totalWeeklyIncome += weeklyPrice;
            totalMonthlyIncome += monthlyPrice;
            occupiedCount++;
        }
        
        // Count payments
        const payments = allPayments[idx] || [];
        totalPaymentsLogged += payments.length;
        payments.forEach(payment => {
            totalRevenueCollected += payment.amount || 0;
        });
    });
    
    const occupancyRate = ownerProps.length > 0 ? Math.round((occupiedCount / ownerProps.length) * 100) : 0;
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-gradient-to-br from-green-600/30 to-emerald-700/30 rounded-xl p-4 border border-green-500/30">
                    <div class="text-green-400 text-sm font-bold mb-1">💰 Weekly Income</div>
                    <div class="text-2xl font-black text-white">$${formatLargeNumber(totalWeeklyIncome)}</div>
                    <div class="text-green-300/60 text-xs mt-1">From ${occupiedCount} occupied units</div>
                </div>
                <div class="bg-gradient-to-br from-blue-600/30 to-cyan-700/30 rounded-xl p-4 border border-blue-500/30">
                    <div class="text-blue-400 text-sm font-bold mb-1">📅 Monthly Income</div>
                    <div class="text-2xl font-black text-white">$${formatLargeNumber(totalMonthlyIncome)}</div>
                    <div class="text-blue-300/60 text-xs mt-1">Projected monthly</div>
                </div>
                <div class="bg-gradient-to-br from-purple-600/30 to-pink-700/30 rounded-xl p-4 border border-purple-500/30">
                    <div class="text-purple-400 text-sm font-bold mb-1">🏠 Occupancy Rate</div>
                    <div class="text-2xl font-black text-white">${occupancyRate}%</div>
                    <div class="text-purple-300/60 text-xs mt-1">${occupiedCount}/${ownerProps.length} units</div>
                </div>
                <div class="bg-gradient-to-br from-amber-600/30 to-orange-700/30 rounded-xl p-4 border border-amber-500/30">
                    <div class="text-amber-400 text-sm font-bold mb-1">📊 Total Collected</div>
                    <div class="text-2xl font-black text-white">$${formatLargeNumber(totalRevenueCollected)}</div>
                    <div class="text-amber-300/60 text-xs mt-1">${totalPaymentsLogged} payments logged</div>
                </div>
            </div>
            
            <!-- Occupancy Visual -->
            <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <h4 class="text-lg font-bold text-white mb-4">📈 Portfolio Health</h4>
                <div class="space-y-4">
                    <!-- Occupancy Bar -->
                    <div>
                        <div class="flex justify-between text-sm mb-2">
                            <span class="text-gray-400">Occupancy Rate</span>
                            <span class="text-white font-bold">${occupancyRate}%</span>
                        </div>
                        <div class="h-4 bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500" 
                                 style="width: ${occupancyRate}%"></div>
                        </div>
                    </div>
                    
                    <!-- Quick Stats Row -->
                    <div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
                        <div class="text-center">
                            <div class="text-2xl font-black text-green-400">${occupiedCount}</div>
                            <div class="text-xs text-gray-400">Occupied</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-black text-yellow-400">${ownerProps.length - occupiedCount}</div>
                            <div class="text-xs text-gray-400">Available</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-black text-blue-400">${ownerProps.length}</div>
                            <div class="text-xs text-gray-400">Total Units</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Top Performers Preview -->
            <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <h4 class="text-lg font-bold text-white mb-4">🏆 Top Performing Properties</h4>
                ${generateTopPerformersPreview(ownerProps)}
            </div>
        </div>
    `;
}

// Generate Top Performers Preview
function generateTopPerformersPreview(ownerProps) {
    // Sort by weekly price (occupied properties first)
    const sorted = [...ownerProps].sort((a, b) => {
        const aOccupied = state.availability[a.id] === false;
        const bOccupied = state.availability[b.id] === false;
        const aPrice = PropertyDataService.getValue(a.id, 'weeklyPrice', a.weeklyPrice || 0);
        const bPrice = PropertyDataService.getValue(b.id, 'weeklyPrice', b.weeklyPrice || 0);
        
        // Occupied properties with highest income first
        if (aOccupied && !bOccupied) return -1;
        if (!aOccupied && bOccupied) return 1;
        return bPrice - aPrice;
    });
    
    const top3 = sorted.slice(0, 3);
    
    if (top3.length === 0) {
        return '<p class="text-gray-500 text-center py-4">No properties to analyze</p>';
    }
    
    return `
        <div class="space-y-3">
            ${top3.map((p, idx) => {
                const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
                const isOccupied = state.availability[p.id] === false;
                const renterName = PropertyDataService.getValue(p.id, 'renterName', '');
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                
                return `
                    <div class="flex items-center justify-between bg-gray-700/50 rounded-lg p-3">
                        <div class="flex items-center gap-3">
                            <span class="text-xl">${medal}</span>
                            <div>
                                <div class="font-bold text-white">${p.title}</div>
                                <div class="text-xs text-gray-400">
                                    ${isOccupied ? `<span class="text-green-400">● Rented to ${renterName || 'Unknown'}</span>` : '<span class="text-yellow-400">○ Available</span>'}
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold ${isOccupied ? 'text-green-400' : 'text-gray-400'}">$${weeklyPrice.toLocaleString()}/wk</div>
                            <div class="text-xs text-gray-500">$${(weeklyPrice * 4).toLocaleString()}/mo</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Generate Income Report
async function generateIncomeReport() {
    const content = document.getElementById('reportContent');
    const ownerProps = getOwnedProperties();
    
    // Gather all payment data
    const paymentPromises = ownerProps.map(p => getPaymentHistory(p.id));
    const allPayments = await Promise.all(paymentPromises);
    
    // Calculate income by property
    const incomeByProperty = ownerProps.map((p, idx) => {
        const payments = allPayments[idx] || [];
        const totalCollected = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
        const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
        const isOccupied = state.availability[p.id] === false;
        
        return {
            property: p,
            totalCollected,
            weeklyPrice,
            monthlyPrice: weeklyPrice * 4,
            paymentCount: payments.length,
            isOccupied
        };
    }).sort((a, b) => b.totalCollected - a.totalCollected);
    
    // Calculate totals
    const grandTotalCollected = incomeByProperty.reduce((sum, p) => sum + p.totalCollected, 0);
    const maxCollected = Math.max(...incomeByProperty.map(p => p.totalCollected), 1);
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Income Summary -->
            <div class="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-5 border border-green-500/30">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="text-green-400 text-sm font-bold">💰 Total Revenue Collected</div>
                        <div class="text-4xl font-black text-white mt-1">$${formatLargeNumber(grandTotalCollected)}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-gray-400 text-sm">Across ${incomeByProperty.length} properties</div>
                        <div class="text-gray-400 text-sm">${incomeByProperty.reduce((sum, p) => sum + p.paymentCount, 0)} total payments</div>
                    </div>
                </div>
            </div>
            
            <!-- Income by Property Chart -->
            <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <h4 class="text-lg font-bold text-white mb-4">📊 Revenue by Property</h4>
                <div class="space-y-4">
                    ${incomeByProperty.map(item => {
                        const percentage = maxCollected > 0 ? (item.totalCollected / maxCollected) * 100 : 0;
                        return `
                            <div>
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="text-white font-medium truncate max-w-[60%]">${item.property.title}</span>
                                    <span class="text-green-400 font-bold">$${formatLargeNumber(item.totalCollected)}</span>
                                </div>
                                <div class="h-6 bg-gray-700 rounded-lg overflow-hidden relative">
                                    <div class="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-lg transition-all duration-500 flex items-center justify-end pr-2" 
                                         style="width: ${Math.max(percentage, 5)}%">
                                        ${item.paymentCount > 0 ? `<span class="text-xs text-white font-bold">${item.paymentCount} payments</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Income Potential -->
            <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <h4 class="text-lg font-bold text-white mb-4">💡 Income Potential</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-gray-700/50 rounded-lg p-4">
                        <div class="text-sm text-gray-400 mb-1">If All Units Occupied (Weekly)</div>
                        <div class="text-2xl font-black text-blue-400">
                            $${formatLargeNumber(incomeByProperty.reduce((sum, p) => sum + p.weeklyPrice, 0))}
                        </div>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-4">
                        <div class="text-sm text-gray-400 mb-1">If All Units Occupied (Monthly)</div>
                        <div class="text-2xl font-black text-purple-400">
                            $${formatLargeNumber(incomeByProperty.reduce((sum, p) => sum + p.monthlyPrice, 0))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Generate Occupancy Report
async function generateOccupancyReport() {
    const content = document.getElementById('reportContent');
    const ownerProps = getOwnedProperties();
    
    // Calculate occupancy stats
    const occupied = ownerProps.filter(p => state.availability[p.id] === false);
    const available = ownerProps.filter(p => state.availability[p.id] !== false);
    const occupancyRate = ownerProps.length > 0 ? Math.round((occupied.length / ownerProps.length) * 100) : 0;
    
    // Group by property type
    const byType = {};
    ownerProps.forEach(p => {
        const type = PropertyDataService.getValue(p.id, 'type', p.type || 'other');
        if (!byType[type]) {
            byType[type] = { total: 0, occupied: 0 };
        }
        byType[type].total++;
        if (state.availability[p.id] === false) {
            byType[type].occupied++;
        }
    });
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Occupancy Overview -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-gradient-to-br from-green-600/30 to-emerald-700/30 rounded-xl p-5 border border-green-500/30 text-center">
                    <div class="text-5xl font-black text-green-400">${occupied.length}</div>
                    <div class="text-green-300 font-bold mt-2">Occupied Units</div>
                    <div class="text-green-400/60 text-sm">Generating income</div>
                </div>
                <div class="bg-gradient-to-br from-yellow-600/30 to-amber-700/30 rounded-xl p-5 border border-yellow-500/30 text-center">
                    <div class="text-5xl font-black text-yellow-400">${available.length}</div>
                    <div class="text-yellow-300 font-bold mt-2">Available Units</div>
                    <div class="text-yellow-400/60 text-sm">Ready to rent</div>
                </div>
                <div class="bg-gradient-to-br from-purple-600/30 to-pink-700/30 rounded-xl p-5 border border-purple-500/30 text-center">
                    <div class="text-5xl font-black text-purple-400">${occupancyRate}%</div>
                    <div class="text-purple-300 font-bold mt-2">Occupancy Rate</div>
                    <div class="text-purple-400/60 text-sm">Portfolio efficiency</div>
                </div>
            </div>
            
            <!-- Visual Occupancy Breakdown -->
            <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <h4 class="text-lg font-bold text-white mb-4">🏠 Unit Status</h4>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    ${ownerProps.map(p => {
                        const isOccupied = state.availability[p.id] === false;
                        const renterName = PropertyDataService.getValue(p.id, 'renterName', '');
                        return `
                            <div class="relative group cursor-pointer" title="${p.title}${isOccupied ? ' - ' + renterName : ''}">
                                <div class="aspect-square rounded-xl ${isOccupied ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-gray-600 to-gray-700'} flex items-center justify-center text-2xl shadow-lg">
                                    ${isOccupied ? '🏠' : '🔑'}
                                </div>
                                <div class="absolute inset-0 bg-black/80 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center p-2">
                                    <div class="text-center">
                                        <div class="text-xs text-white font-bold truncate">${p.title.split(' ').slice(0, 2).join(' ')}</div>
                                        <div class="text-[10px] ${isOccupied ? 'text-green-400' : 'text-yellow-400'}">${isOccupied ? 'Occupied' : 'Available'}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Occupancy by Type -->
            <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <h4 class="text-lg font-bold text-white mb-4">📊 Occupancy by Property Type</h4>
                <div class="space-y-4">
                    ${Object.entries(byType).map(([type, data]) => {
                        const rate = Math.round((data.occupied / data.total) * 100);
                        return `
                            <div>
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="text-white font-medium capitalize">${type}</span>
                                    <span class="text-gray-400">${data.occupied}/${data.total} occupied (${rate}%)</span>
                                </div>
                                <div class="h-4 bg-gray-700 rounded-full overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" 
                                         style="width: ${rate}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Available Units List -->
            ${available.length > 0 ? `
                <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                    <h4 class="text-lg font-bold text-white mb-4">🔑 Available Units</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${available.map(p => {
                            const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
                            return `
                                <div class="bg-gray-700/50 rounded-lg p-3 flex justify-between items-center">
                                    <div>
                                        <div class="font-bold text-white">${p.title}</div>
                                        <div class="text-xs text-gray-400">${p.location}</div>
                                    </div>
                                    <div class="text-yellow-400 font-bold">$${weeklyPrice.toLocaleString()}/wk</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Generate Payments Report
async function generatePaymentsReport() {
    const content = document.getElementById('reportContent');
    const ownerProps = getOwnedProperties();
    
    // Gather all payment data
    const paymentPromises = ownerProps.map(p => getPaymentHistory(p.id));
    const allPayments = await Promise.all(paymentPromises);
    
    // Flatten and sort all payments
    const flatPayments = [];
    ownerProps.forEach((p, idx) => {
        const payments = allPayments[idx] || [];
        payments.forEach(payment => {
            flatPayments.push({
                ...payment,
                propertyId: p.id,
                propertyTitle: p.title
            });
        });
    });
    
    // Sort by date descending
    flatPayments.sort((a, b) => {
        const aDate = new Date(a.paymentDate || a.recordedAt);
        const bDate = new Date(b.paymentDate || b.recordedAt);
        return bDate - aDate;
    });
    
    // Calculate stats
    const totalPayments = flatPayments.length;
    const totalAmount = flatPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const avgPayment = totalPayments > 0 ? Math.round(totalAmount / totalPayments) : 0;
    
    // Group by month
    const byMonth = {};
    flatPayments.forEach(payment => {
        const date = new Date(payment.paymentDate || payment.recordedAt);
        const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!byMonth[monthKey]) {
            byMonth[monthKey] = { count: 0, total: 0 };
        }
        byMonth[monthKey].count++;
        byMonth[monthKey].total += payment.amount || 0;
    });
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Payment Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-gradient-to-br from-blue-600/30 to-cyan-700/30 rounded-xl p-5 border border-blue-500/30 text-center">
                    <div class="text-4xl font-black text-blue-400">${totalPayments}</div>
                    <div class="text-blue-300 font-bold mt-2">Total Payments</div>
                </div>
                <div class="bg-gradient-to-br from-green-600/30 to-emerald-700/30 rounded-xl p-5 border border-green-500/30 text-center">
                    <div class="text-4xl font-black text-green-400">$${formatLargeNumber(totalAmount)}</div>
                    <div class="text-green-300 font-bold mt-2">Total Collected</div>
                </div>
                <div class="bg-gradient-to-br from-purple-600/30 to-pink-700/30 rounded-xl p-5 border border-purple-500/30 text-center">
                    <div class="text-4xl font-black text-purple-400">$${formatLargeNumber(avgPayment)}</div>
                    <div class="text-purple-300 font-bold mt-2">Avg Payment</div>
                </div>
            </div>
            
            <!-- Monthly Breakdown -->
            ${Object.keys(byMonth).length > 0 ? `
                <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                    <h4 class="text-lg font-bold text-white mb-4">📅 Monthly Summary</h4>
                    <div class="space-y-3">
                        ${Object.entries(byMonth).slice(0, 6).map(([month, data]) => `
                            <div class="flex items-center justify-between bg-gray-700/50 rounded-lg p-3">
                                <div>
                                    <div class="font-bold text-white">${month}</div>
                                    <div class="text-xs text-gray-400">${data.count} payment${data.count !== 1 ? 's' : ''}</div>
                                </div>
                                <div class="text-green-400 font-bold text-lg">$${formatLargeNumber(data.total)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Recent Payments -->
            <div class="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                <h4 class="text-lg font-bold text-white mb-4">💳 Recent Payments</h4>
                ${flatPayments.length > 0 ? `
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-left text-gray-400 border-b border-gray-700">
                                    <th class="pb-3 font-medium">Date</th>
                                    <th class="pb-3 font-medium">Property</th>
                                    <th class="pb-3 font-medium">Renter</th>
                                    <th class="pb-3 font-medium text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody class="text-gray-300">
                                ${flatPayments.slice(0, 15).map(payment => {
                                    const date = new Date(payment.paymentDate || payment.recordedAt);
                                    return `
                                        <tr class="border-b border-gray-700/50">
                                            <td class="py-3">${date.toLocaleDateString()}</td>
                                            <td class="py-3 truncate max-w-[150px]">${payment.propertyTitle}</td>
                                            <td class="py-3">${payment.renterName || 'Unknown'}</td>
                                            <td class="py-3 text-right text-green-400 font-bold">$${(payment.amount || 0).toLocaleString()}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    ${flatPayments.length > 15 ? `
                        <p class="text-gray-500 text-sm mt-4 text-center">Showing 15 of ${flatPayments.length} payments</p>
                    ` : ''}
                ` : `
                    <p class="text-gray-500 text-center py-8">No payments logged yet. Start tracking payments on your property stats pages!</p>
                `}
            </div>
        </div>
    `;
}

// Export report data
window.exportReportData = async function() {
    const ownerProps = getOwnedProperties();
    
    // Gather all payment data
    const paymentPromises = ownerProps.map(p => getPaymentHistory(p.id));
    const allPayments = await Promise.all(paymentPromises);
    
    // Build CSV data
    let csv = 'Property,Type,Weekly Price,Monthly Price,Status,Renter,Payments Logged,Total Collected\n';
    
    ownerProps.forEach((p, idx) => {
        const weeklyPrice = PropertyDataService.getValue(p.id, 'weeklyPrice', p.weeklyPrice || 0);
        const monthlyPrice = PropertyDataService.getValue(p.id, 'monthlyPrice', p.monthlyPrice || weeklyPrice * 4);
        const isOccupied = state.availability[p.id] === false;
        const renterName = PropertyDataService.getValue(p.id, 'renterName', '') || '';
        const payments = allPayments[idx] || [];
        const totalCollected = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
        
        csv += `"${p.title}","${p.type}",${weeklyPrice},${monthlyPrice},"${isOccupied ? 'Occupied' : 'Available'}","${renterName}",${payments.length},${totalCollected}\n`;
    });
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('📥 Report exported!', 'success');
};

// Helper to get owner properties (for VIEWING - admin sees all)
function getOwnerProperties() {
    const user = auth.currentUser;
    if (!user) return [];
    
    // Master admin sees all properties for management
    if (TierService.isMasterAdmin(user.email)) {
        return properties;
    }
    
    return getOwnedProperties();
}

// Helper to get properties user actually OWNS (for FINANCIALS - never all properties)
// CRITICAL: Uses OwnershipService for consistent ownership across entire application
function getOwnedProperties() {
    const user = auth.currentUser;
    if (!user) return [];
    
    return OwnershipService.getPropertiesForOwner(user.email);
}

// Format large numbers
function formatLargeNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'k';
    }
    return num.toLocaleString();
}

// Call this when dashboard loads to show/hide reports button
// Will be called from renderOwnerDashboard

