/**
 * ============================================================================
 * AGENT MANAGEMENT - Sales Agent System
 * ============================================================================
 * 
 * Features:
 * - Agent role management (promote/demote users)
 * - Property agent assignments (multiple agents per property)
 * - Commission tracking (10% of sale price, split evenly)
 * - Contact override for Make an Offer
 * 
 * Data Model:
 * - users/{odId}: isAgent (boolean), agentPhone (string)
 * - settings/properties: agents[] (array of agent emails per property)
 * 
 * ============================================================================
 */

// Cache for agents list
window.agentsCache = [];
window.agentsCacheTime = 0;
var AGENTS_CACHE_TTL = 60000; // 1 minute cache

/**
 * Check if current user can manage agents
 * Only Master Admin can promote/demote agent role
 */
function canManageAgentRole() {
    return TierService.isMasterAdmin(auth.currentUser?.email);
}

/**
 * Check if current user can assign agents to a vehicle
 * Master Admin or Property Owner
 */
function canAssignAgents(propertyId) {
    if (!auth.currentUser) return false;
    if (TierService.isMasterAdmin(auth.currentUser.email)) return true;
    
    // Check if user owns this vehicle
    var ownerEmail = PropertyDataService.getValue(propertyId, 'ownerEmail', null);
    if (!ownerEmail) {
        ownerEmail = propertyOwnerEmail[propertyId];
    }
    return ownerEmail && ownerEmail.toLowerCase() === auth.currentUser.email.toLowerCase();
}

/**
 * Load all users with agent role
 */
window.loadAgents = async function(forceRefresh) {
    if (!forceRefresh && agentsCache.length > 0 && Date.now() - agentsCacheTime < AGENTS_CACHE_TTL) {
        return agentsCache;
    }
    
    try {
        var masterAdminEmail = 'richard2019201900@gmail.com';
        var masterAdminLower = masterAdminEmail.toLowerCase();
        var seenEmails = {}; // Track emails to prevent duplicates
        var tempAgents = [];
        
        // First, always fetch and add master admin at the top
        var masterSnapshot = await db.collection('users')
            .where('email', '==', masterAdminEmail)
            .limit(1)
            .get();
        
        if (!masterSnapshot.empty) {
            var masterData = masterSnapshot.docs[0].data();
            tempAgents.push({
                odId: masterSnapshot.docs[0].id,
                email: masterAdminEmail,
                username: 'Pauly Amato', // Always use consistent name for master admin
                phone: masterData.phone || '2057028233',
                tier: 'owner',
                isAgent: true,
                agentSince: 'System Default'
            });
            seenEmails[masterAdminLower] = true;
        }
        
        // Then fetch all other agents
        var snapshot = await db.collection('users').where('isAgent', '==', true).get();
        
        snapshot.forEach(function(doc) {
            var data = doc.data();
            var emailLower = (data.email || '').toLowerCase();
            
            // Skip if we've already seen this email (case-insensitive)
            // This will skip master admin if they have isAgent: true
            if (seenEmails[emailLower]) {
                return;
            }
            seenEmails[emailLower] = true;
            
            tempAgents.push({
                odId: doc.id,
                email: data.email,
                username: data.username || data.email.split('@')[0],
                phone: data.phone || '',
                tier: data.tier || 'free',
                isAgent: true,
                agentSince: data.agentSince || null
            });
        });
        
        agentsCache = tempAgents;
        agentsCacheTime = Date.now();
        console.log('[Agents] Loaded', agentsCache.length, 'agents');
        return agentsCache;
    } catch (error) {
        console.error('[Agents] Error loading agents:', error);
        return agentsCache;
    }
};

/**
 * Promote user to agent role
 */
window.promoteToAgent = async function(odId, email) {
    if (!canManageAgentRole()) {
        showToast('Only Master Admin can manage agent roles', 'error');
        return false;
    }
    
    try {
        // First check if user has a phone number
        var userDoc = await db.collection('users').doc(odId).get();
        if (!userDoc.exists) {
            showToast('User not found', 'error');
            return false;
        }
        
        var userData = userDoc.data();
        if (!userData.phone) {
            showToast('User must have a phone number before becoming an agent', 'error');
            return false;
        }
        
        // Update user document
        await db.collection('users').doc(odId).update({
            isAgent: true,
            agentSince: new Date().toISOString().split('T')[0]
        });
        
        // Clear cache
        agentsCacheTime = 0;
        
        // Log activity
        if (typeof logActivity === 'function') {
            logActivity('agent_promote', 'Promoted user to agent: ' + email);
        }
        
        showToast('✅ ' + (userData.username || email) + ' is now an agent!', 'success');
        return true;
    } catch (error) {
        console.error('[Agents] Error promoting user:', error);
        showToast('Failed to promote user: ' + error.message, 'error');
        return false;
    }
};

/**
 * Demote user from agent role
 */
window.demoteFromAgent = async function(odId, email) {
    if (!canManageAgentRole()) {
        showToast('Only Master Admin can manage agent roles', 'error');
        return false;
    }
    
    // Don't allow demoting master admin
    if (email.toLowerCase() === 'richard2019201900@gmail.com') {
        showToast('Cannot remove agent role from Master Admin', 'error');
        return false;
    }
    
    try {
        // Remove from all property assignments first
        var propsDoc = await db.collection('settings').doc('properties').get();
        if (propsDoc.exists) {
            var properties = propsDoc.data();
            var updates = {};
            var removedCount = 0;
            
            Object.keys(properties).forEach(function(propId) {
                var prop = properties[propId];
                if (prop.agents && Array.isArray(prop.agents)) {
                    var idx = prop.agents.findIndex(function(a) {
                        return a.toLowerCase() === email.toLowerCase();
                    });
                    if (idx !== -1) {
                        var newAgents = prop.agents.filter(function(a) {
                            return a.toLowerCase() !== email.toLowerCase();
                        });
                        updates[propId + '.agents'] = newAgents;
                        removedCount++;
                    }
                }
            });
            
            if (Object.keys(updates).length > 0) {
                await db.collection('settings').doc('properties').update(updates);
            }
            
            if (removedCount > 0) {
                console.log('[Agents] Removed agent from', removedCount, 'properties');
            }
        }
        
        // Update user document
        await db.collection('users').doc(odId).update({
            isAgent: false,
            agentSince: firebase.firestore.FieldValue.delete()
        });
        
        // Clear cache
        agentsCacheTime = 0;
        
        // Log activity
        if (typeof logActivity === 'function') {
            logActivity('agent_demote', 'Removed agent role from: ' + email);
        }
        
        showToast('Agent role removed from ' + email, 'success');
        return true;
    } catch (error) {
        console.error('[Agents] Error demoting user:', error);
        showToast('Failed to demote user: ' + error.message, 'error');
        return false;
    }
};

/**
 * Assign agent to vehicle
 */
window.assignAgentToProperty = async function(propertyId, agentEmail) {
    if (!canAssignAgents(propertyId)) {
        showToast('You do not have permission to assign agents to this vehicle', 'error');
        return false;
    }
    
    try {
        var propsDoc = await db.collection('settings').doc('properties').get();
        var properties = propsDoc.exists ? propsDoc.data() : {};
        var propKey = String(propertyId);
        
        if (!properties[propKey]) {
            properties[propKey] = {};
        }
        
        var currentAgents = properties[propKey].agents || [];
        
        // Check if already assigned
        var alreadyAssigned = currentAgents.some(function(a) {
            return a.toLowerCase() === agentEmail.toLowerCase();
        });
        
        if (alreadyAssigned) {
            showToast('Agent is already assigned to this vehicle', 'info');
            return false;
        }
        
        // Add agent
        currentAgents.push(agentEmail.toLowerCase());
        
        // Get agent display name AND phone for public viewing (anonymous users can't query users collection)
        var agentDisplayName = 'Agent';
        var agentPhone = '2057028233'; // Default to Pauly's number
        
        if (agentEmail.toLowerCase() === 'richard2019201900@gmail.com') {
            agentDisplayName = 'Pauly Amato';
            agentPhone = '2057028233';
        } else {
            // Try to get from cache
            await loadAgents();
            var agent = agentsCache.find(function(a) { 
                return a.email.toLowerCase() === agentEmail.toLowerCase(); 
            });
            if (agent) {
                agentDisplayName = agent.username;
                agentPhone = agent.phone || '2057028233';
            }
        }
        
        // Store agent display names AND phones map for public view
        var agentDisplayNames = properties[propKey].agentDisplayNames || {};
        var agentPhones = properties[propKey].agentPhones || {};
        agentDisplayNames[agentEmail.toLowerCase()] = agentDisplayName;
        agentPhones[agentEmail.toLowerCase()] = agentPhone;
        
        await db.collection('settings').doc('properties').update({
            [propKey + '.agents']: currentAgents,
            [propKey + '.agentDisplayNames']: agentDisplayNames,
            [propKey + '.agentPhones']: agentPhones
        });
        
        // Update local cache
        var localProp = window.properties?.find(function(p) { return p.id == propertyId; });
        if (localProp) {
            localProp.agents = currentAgents;
            localProp.agentDisplayNames = agentDisplayNames;
            localProp.agentPhones = agentPhones;
        }
        
        // Log activity
        if (typeof logActivity === 'function') {
            var prop = properties.find(function(p) { return p.id == propertyId; }) || { title: 'Property ' + propertyId };
            logActivity('agent_assign', 'Assigned ' + agentEmail + ' to ' + (prop.title || 'Property ' + propertyId));
        }
        
        showToast('✅ Agent assigned to vehicle', 'success');
        return true;
    } catch (error) {
        console.error('[Agents] Error assigning agent:', error);
        showToast('Failed to assign agent: ' + error.message, 'error');
        return false;
    }
};

/**
 * Remove agent from vehicle
 * @param {boolean} selfRemoval - True if agent is removing themselves
 * @param {string} reason - Required reason when owner removes agent
 */
window.removeAgentFromProperty = async function(propertyId, agentEmail, selfRemoval, reason) {
    var isMasterAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    var isSelf = auth.currentUser?.email.toLowerCase() === agentEmail.toLowerCase();
    
    // Permission check
    if (!isMasterAdmin && !isSelf && !canAssignAgents(propertyId)) {
        showToast('You do not have permission to remove agents from this vehicle', 'error');
        return false;
    }
    
    // If owner removing agent (not self, not master admin), require reason
    if (!isMasterAdmin && !isSelf && !reason) {
        showToast('A reason is required when removing an agent', 'error');
        return false;
    }
    
    try {
        var propsDoc = await db.collection('settings').doc('properties').get();
        if (!propsDoc.exists) return false;
        
        var properties = propsDoc.data();
        var propKey = String(propertyId);
        
        if (!properties[propKey] || !properties[propKey].agents) {
            showToast('No agents assigned to this vehicle', 'info');
            return false;
        }
        
        var newAgents = properties[propKey].agents.filter(function(a) {
            return a.toLowerCase() !== agentEmail.toLowerCase();
        });
        
        await db.collection('settings').doc('properties').update({
            [propKey + '.agents']: newAgents
        });
        
        // Log activity with reason if provided
        if (typeof logActivity === 'function') {
            var action = isSelf ? 'agent_self_remove' : 'agent_remove';
            var msg = (isSelf ? 'Self-removed from' : 'Removed ' + agentEmail + ' from') + ' property ' + propertyId;
            if (reason) msg += ' - Reason: ' + reason;
            logActivity(action, msg);
        }
        
        showToast(isSelf ? 'You have been removed from this vehicle' : 'Agent removed from vehicle', 'success');
        return true;
    } catch (error) {
        console.error('[Agents] Error removing agent:', error);
        showToast('Failed to remove agent: ' + error.message, 'error');
        return false;
    }
};

/**
 * Get agents assigned to a vehicle
 */
window.getPropertyAgents = function(propertyId) {
    var agents = PropertyDataService.getValue(propertyId, 'agents', []);
    if (!Array.isArray(agents)) return [];
    return agents;
};

/**
 * Get agent contact info for Make an Offer modal
 * Returns array of {email, phone, username} for all assigned agents
 * Works for both authenticated AND anonymous users
 */
window.getAgentContactsForProperty = async function(propertyId) {
    var agentEmails = getPropertyAgents(propertyId);
    if (agentEmails.length === 0) return [];
    
    var contacts = [];
    
    // First, try to get from vehicle data via PropertyDataService (works for anonymous users)
    var agentDisplayNames = PropertyDataService.getValue(propertyId, 'agentDisplayNames', null);
    var agentPhones = PropertyDataService.getValue(propertyId, 'agentPhones', null);
    
    if (agentDisplayNames && agentPhones) {
        // Use stored agent data from vehicle (no auth required)
        agentEmails.forEach(function(email) {
            var emailLower = email.toLowerCase();
            var displayName = agentDisplayNames[emailLower];
            var phone = agentPhones[emailLower];
            
            if (displayName && phone) {
                contacts.push({
                    email: emailLower,
                    phone: phone,
                    username: displayName
                });
            }
        });
        
        if (contacts.length > 0) {
            return contacts;
        }
    }
    
    // Fallback: Try to load from users collection (requires auth)
    try {
        if (auth?.currentUser) {
            await loadAgents();
            
            agentEmails.forEach(function(email) {
                var agent = agentsCache.find(function(a) {
                    return a.email.toLowerCase() === email.toLowerCase();
                });
                if (agent && agent.phone) {
                    contacts.push({
                        email: agent.email,
                        phone: agent.phone,
                        username: agent.username
                    });
                }
            });
        }
    } catch (error) {
        // Silent fail for anonymous users
    }
    
    // Last resort: Check for master admin email
    if (contacts.length === 0) {
        agentEmails.forEach(function(email) {
            if (email.toLowerCase() === 'richard2019201900@gmail.com') {
                contacts.push({
                    email: email,
                    phone: '2057028233',
                    username: 'Pauly Amato'
                });
            }
        });
    }
    
    return contacts;
};

/**
 * Calculate potential commission for an agent on a vehicle
 * Commission = 10% of sale price, split evenly among agents
 */
window.calculateAgentCommission = function(propertyId) {
    var buyPrice = PropertyDataService.getValue(propertyId, 'buyPrice', 0);
    if (!buyPrice) return { total: 0, perAgent: 0, agentCount: 0 };
    
    var agents = getPropertyAgents(propertyId);
    var agentCount = agents.length;
    if (agentCount === 0) return { total: 0, perAgent: 0, agentCount: 0 };
    
    var totalCommission = Math.round(buyPrice * 0.10); // 10% agent fee
    var perAgentCommission = Math.round(totalCommission / agentCount);
    
    return {
        total: totalCommission,
        perAgent: perAgentCommission,
        agentCount: agentCount
    };
};

/**
 * Get all properties an agent is assigned to
 */
window.getAgentProperties = function(agentEmail) {
    var assignedProperties = [];
    
    properties.forEach(function(p) {
        var agents = PropertyDataService.getValue(p.id, 'agents', []);
        if (Array.isArray(agents)) {
            var isAssigned = agents.some(function(a) {
                return a.toLowerCase() === agentEmail.toLowerCase();
            });
            if (isAssigned) {
                assignedProperties.push(p);
            }
        }
    });
    
    return assignedProperties;
};

/**
 * Render the Agents tab content in Admin Dashboard
 */
window.renderAgentsTab = async function() {
    var container = $('adminAgentsTab');
    if (!container) return;
    
    container.innerHTML = '<p class="text-gray-500 italic">Loading agents...</p>';
    
    try {
        var agents = await loadAgents(true);
        
        // Build agent cards
        var agentCardsHtml = '';
        
        if (agents.length === 0) {
            agentCardsHtml = '<p class="text-gray-500 italic">No agents found. Promote users to agent role below.</p>';
        } else {
            agents.forEach(function(agent) {
                var assignedProps = getAgentProperties(agent.email);
                var totalCommission = 0;
                
                assignedProps.forEach(function(p) {
                    var comm = calculateAgentCommission(p.id);
                    totalCommission += comm.perAgent;
                });
                
                var isMasterAdmin = agent.email.toLowerCase() === 'richard2019201900@gmail.com';
                var tierIcon = TierService.getTierIcon ? TierService.getTierIcon(agent.tier) : '';
                
                agentCardsHtml += '<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-4">' +
                    '<div class="flex items-start justify-between">' +
                        '<div class="flex items-center gap-3">' +
                            '<div class="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">' +
                                (agent.username ? agent.username.charAt(0).toUpperCase() : '?') +
                            '</div>' +
                            '<div>' +
                                '<div class="flex items-center gap-2">' +
                                    '<span class="text-white font-bold">' + (agent.username || 'Unknown') + '</span>' +
                                    '<span>' + tierIcon + '</span>' +
                                    (isMasterAdmin ? '<span class="bg-amber-500 text-black text-xs px-2 py-0.5 rounded-full font-bold">MASTER</span>' : '') +
                                '</div>' +
                                '<div class="text-gray-400 text-sm">' + agent.email + '</div>' +
                                '<div class="text-gray-500 text-xs">📞 ' + (agent.phone || 'No phone') + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="text-right">' +
                            '<div class="text-cyan-400 font-bold">' + assignedProps.length + ' vehicles</div>' +
                            '<div class="text-green-400 text-sm">$' + totalCommission.toLocaleString() + ' potential</div>' +
                            (isMasterAdmin ? '' : '<button onclick="confirmDemoteAgent(\'' + agent.odId + '\', \'' + agent.email + '\')" class="mt-2 text-red-400 hover:text-red-300 text-xs">Remove Role</button>') +
                        '</div>' +
                    '</div>' +
                    (assignedProps.length > 0 ? 
                        '<div class="mt-3 pt-3 border-t border-gray-700">' +
                            '<div class="text-gray-400 text-xs mb-2">Assigned Vehicles:</div>' +
                            '<div class="flex flex-wrap gap-2">' +
                                assignedProps.map(function(p) {
                                    return '<span class="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">' + p.title + '</span>';
                                }).join('') +
                            '</div>' +
                        '</div>' 
                    : '') +
                '</div>';
            });
        }
        
        // Build add agent section
        var addAgentHtml = '<div class="bg-gray-800/50 rounded-xl border border-cyan-700 p-4 mt-6">' +
            '<h4 class="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">➕ Add New Agent</h4>' +
            '<div class="flex flex-col md:flex-row gap-3">' +
                '<div class="flex-1">' +
                    '<input type="text" id="agentSearchInput" placeholder="Search users by name or email..." ' +
                        'class="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white" ' +
                        'oninput="searchUsersForAgent(this.value)">' +
                    '<div id="agentSearchResults" class="mt-2 max-h-48 overflow-y-auto"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
        
        container.innerHTML = 
            '<div class="flex justify-between items-center mb-4">' +
                '<h4 class="text-lg font-bold text-gray-200">Sales Agents</h4>' +
                '<button onclick="renderAgentsTab()" class="text-purple-400 hover:text-purple-300 text-sm font-bold px-3 py-2 bg-gray-700 rounded-lg">🔄 Refresh</button>' +
            '</div>' +
            '<div class="space-y-4">' + agentCardsHtml + '</div>' +
            addAgentHtml;
            
    } catch (error) {
        console.error('[Agents] Error rendering tab:', error);
        container.innerHTML = '<p class="text-red-400">Error loading agents: ' + error.message + '</p>';
    }
};

/**
 * Search users for agent promotion
 */
window.searchUsersForAgent = async function(query) {
    var container = $('agentSearchResults');
    if (!container) return;
    
    if (!query || query.length < 2) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Type at least 2 characters to search...</p>';
        return;
    }
    
    container.innerHTML = '<p class="text-gray-500 text-sm">Searching...</p>';
    
    try {
        var snapshot = await db.collection('users').limit(100).get();
        var results = [];
        var queryLower = query.toLowerCase();
        
        snapshot.forEach(function(doc) {
            var data = doc.data();
            var matchesUsername = data.username && data.username.toLowerCase().includes(queryLower);
            var matchesEmail = data.email && data.email.toLowerCase().includes(queryLower);
            
            if (matchesUsername || matchesEmail) {
                // Exclude users who are already agents
                if (!data.isAgent) {
                    results.push({
                        odId: doc.id,
                        email: data.email,
                        username: data.username || data.email.split('@')[0],
                        phone: data.phone || '',
                        tier: data.tier || 'free'
                    });
                }
            }
        });
        
        if (results.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No non-agent users found matching "' + query + '"</p>';
            return;
        }
        
        var html = results.slice(0, 10).map(function(user) {
            var hasPhone = !!user.phone;
            var tierIcon = TierService.getTierIcon ? TierService.getTierIcon(user.tier) : '';
            
            return '<div class="flex items-center justify-between bg-gray-700 rounded-lg p-2">' +
                '<div>' +
                    '<span class="text-white font-medium">' + user.username + '</span> ' +
                    '<span>' + tierIcon + '</span>' +
                    '<div class="text-gray-400 text-xs">' + user.email + '</div>' +
                    (hasPhone ? '<div class="text-gray-500 text-xs">📞 ' + user.phone + '</div>' : '<div class="text-amber-400 text-xs">⚠️ No phone number</div>') +
                '</div>' +
                (hasPhone ? 
                    '<button onclick="confirmPromoteAgent(\'' + user.odId + '\', \'' + user.email + '\', \'' + user.username + '\')" class="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded-lg text-sm font-bold">Make Agent</button>'
                    : '<span class="text-gray-500 text-xs">Phone required</span>') +
            '</div>';
        }).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('[Agents] Error searching users:', error);
        container.innerHTML = '<p class="text-red-400 text-sm">Error searching: ' + error.message + '</p>';
    }
};

/**
 * Confirm promote agent dialog
 */
window.confirmPromoteAgent = function(odId, email, username) {
    if (confirm('Promote ' + username + ' (' + email + ') to Agent role?\n\nThis will allow them to be assigned to vehicles and receive offer inquiries.')) {
        promoteToAgent(odId, email).then(function(success) {
            if (success) {
                renderAgentsTab();
            }
        });
    }
};

/**
 * Confirm demote agent dialog
 */
window.confirmDemoteAgent = function(odId, email) {
    if (confirm('Remove Agent role from ' + email + '?\n\nThis will also remove them from all assigned vehicles.')) {
        demoteFromAgent(odId, email).then(function(success) {
            if (success) {
                renderAgentsTab();
            }
        });
    }
};

/**
 * Render agent management section for Property Stats page
 * Returns HTML string to be inserted into container
 */
window.renderPropertyAgentSection = async function(propertyId) {
    var canAssign = canAssignAgents(propertyId);
    var currentAgents = getPropertyAgents(propertyId);
    var allAgents = await loadAgents();
    var isMasterAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    var userEmail = auth.currentUser?.email?.toLowerCase();
    
    var html = '<h4 class="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">🏢 Sales Agents</h4>';
    
    // Current agents list
    if (currentAgents.length === 0) {
        html += '<p class="text-gray-500 italic mb-4">No agents assigned. Contact info will default to vehicle owner.</p>';
    } else {
        html += '<div class="space-y-2 mb-4">';
        currentAgents.forEach(function(agentEmail) {
            var agent = allAgents.find(function(a) { return a.email.toLowerCase() === agentEmail.toLowerCase(); });
            var canRemove = isMasterAdmin || (userEmail === agentEmail.toLowerCase()) || canAssign;
            var isSelf = userEmail === agentEmail.toLowerCase();
            
            html += '<div class="flex items-center justify-between bg-gray-700 rounded-lg p-3">' +
                '<div class="flex items-center gap-3">' +
                    '<div class="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-sm">' +
                        (agent ? agent.username.charAt(0).toUpperCase() : '?') +
                    '</div>' +
                    '<div>' +
                        '<div class="text-white font-medium">' + (agent ? agent.username : agentEmail) + '</div>' +
                        '<div class="text-gray-400 text-xs">📞 ' + (agent ? agent.phone : 'Unknown') + '</div>' +
                    '</div>' +
                '</div>' +
                (canRemove ? 
                    '<button onclick="promptRemoveAgentFromProperty(' + propertyId + ', \'' + agentEmail + '\', ' + isSelf + ')" ' +
                        'class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition">' +
                        '✕ Remove Agent' +
                    '</button>' 
                : '') +
            '</div>';
        });
        html += '</div>';
        
        // Commission info
        var commission = calculateAgentCommission(propertyId);
        if (commission.total > 0) {
            html += '<div class="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-4">' +
                '<div class="text-green-400 text-sm font-bold">💰 Agent Commission (10% of sale)</div>' +
                '<div class="text-white">Total: $' + commission.total.toLocaleString() + '</div>' +
                (commission.agentCount > 1 ? '<div class="text-gray-400 text-sm">Split ' + commission.agentCount + ' ways: $' + commission.perAgent.toLocaleString() + ' each</div>' : '') +
            '</div>';
        }
    }
    
    // Add agent dropdown (only if can assign)
    if (canAssign) {
        var availableAgents = allAgents.filter(function(a) {
            return !currentAgents.some(function(ca) { 
                return ca.toLowerCase() === a.email.toLowerCase(); 
            });
        });
        
        html += '<div class="border-t border-gray-700 pt-4">' +
            '<label class="text-gray-400 text-sm block mb-2">Add Sales Agent to Vehicle:</label>' +
            '<div class="flex gap-2">' +
                '<select id="addAgentSelect" class="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white">' +
                    '<option value="">Select an agent...</option>' +
                    availableAgents.map(function(a) {
                        return '<option value="' + a.email + '">' + a.username + ' (' + a.phone + ')</option>';
                    }).join('') +
                '</select>' +
                '<button onclick="addAgentToPropertyFromDropdown(' + propertyId + ')" class="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-bold">Add</button>' +
            '</div>' +
        '</div>';
    }
    
    return html;
};

/**
 * Add agent from dropdown selection
 */
window.addAgentToPropertyFromDropdown = async function(propertyId) {
    var select = $('addAgentSelect');
    if (!select || !select.value) {
        showToast('Please select an agent', 'error');
        return;
    }
    
    var success = await assignAgentToProperty(propertyId, select.value);
    if (success) {
        // Refresh the vehicle stats view
        if (typeof renderPropertyStatsContent === 'function') {
            renderPropertyStatsContent(propertyId);
        }
    }
};

/**
 * Prompt to remove agent with reason (for owner removing agent)
 */
window.promptRemoveAgentFromProperty = function(propertyId, agentEmail, isSelf) {
    var isMasterAdmin = TierService.isMasterAdmin(auth.currentUser?.email);
    
    if (isSelf) {
        if (confirm('Are you sure you want to remove yourself from this vehicle?\n\nYou will no longer receive offer inquiries for this vehicle.')) {
            removeAgentFromProperty(propertyId, agentEmail, true, null).then(function(success) {
                if (success && typeof renderPropertyStatsContent === 'function') {
                    renderPropertyStatsContent(propertyId);
                }
            });
        }
        return;
    }
    
    if (isMasterAdmin) {
        if (confirm('Remove ' + agentEmail + ' from this vehicle?')) {
            removeAgentFromProperty(propertyId, agentEmail, false, 'Admin removal').then(function(success) {
                if (success && typeof renderPropertyStatsContent === 'function') {
                    renderPropertyStatsContent(propertyId);
                }
            });
        }
        return;
    }
    
    // Owner removing agent - require reason with warning
    var reason = prompt(
        'IMPORTANT: You are removing an agent from your vehicle.\n\n' +
        '⚠️ WARNING: Any malicious or unjustified removal of agents may result in a PERMANENT BAN from the site.\n\n' +
        'Please provide a reason for removing this agent:'
    );
    
    if (reason === null) return; // Cancelled
    
    if (!reason.trim()) {
        showToast('A reason is required to remove an agent', 'error');
        return;
    }
    
    removeAgentFromProperty(propertyId, agentEmail, false, reason.trim()).then(function(success) {
        if (success && typeof renderPropertyStatsContent === 'function') {
            renderPropertyStatsContent(propertyId);
        }
    });
};

/**
 * One-time migration: Populate agentDisplayNames for properties that already have agents
 * Run from console: migrateAgentDisplayNames()
 */
window.migrateAgentDisplayNames = async function() {
    if (!TierService.isMasterAdmin(auth.currentUser?.email)) {
        console.error('[Agents] Only master admin can run migration');
        return;
    }
    
    console.log('[Agents] Starting agentDisplayNames migration...');
    
    try {
        // Load agents first
        await loadAgents();
        
        var propsDoc = await db.collection('settings').doc('properties').get();
        if (!propsDoc.exists) {
            console.log('[Agents] No properties found');
            return;
        }
        
        var allProperties = propsDoc.data();
        var updates = {};
        var migratedCount = 0;
        
        Object.entries(allProperties).forEach(function([propId, prop]) {
            if (!prop || !prop.agents || prop.agents.length === 0) return;
            
            // Check if already has BOTH agentDisplayNames AND agentPhones
            var hasDisplayNames = prop.agentDisplayNames && Object.keys(prop.agentDisplayNames).length > 0;
            var hasPhones = prop.agentPhones && Object.keys(prop.agentPhones).length > 0;
            
            if (hasDisplayNames && hasPhones) {
                console.log('[Agents] Property', propId, 'already has agentDisplayNames and agentPhones');
                return;
            }
            
            var displayNames = prop.agentDisplayNames || {};
            var phones = prop.agentPhones || {};
            
            prop.agents.forEach(function(agentEmail) {
                var emailLower = agentEmail.toLowerCase();
                
                // Master admin special case
                if (emailLower === 'richard2019201900@gmail.com') {
                    displayNames[emailLower] = 'Pauly Amato';
                    phones[emailLower] = '2057028233';
                } else {
                    // Find in cache
                    var agent = agentsCache.find(function(a) {
                        return a.email.toLowerCase() === emailLower;
                    });
                    if (agent) {
                        displayNames[emailLower] = agent.username;
                        phones[emailLower] = agent.phone || '2057028233';
                    } else {
                        displayNames[emailLower] = 'Agent';
                        phones[emailLower] = '2057028233'; // Fallback to Pauly
                    }
                }
            });
            
            updates[propId + '.agentDisplayNames'] = displayNames;
            updates[propId + '.agentPhones'] = phones;
            migratedCount++;
            console.log('[Agents] Will migrate property', propId, ':', { displayNames, phones });
        });
        
        if (Object.keys(updates).length === 0) {
            console.log('[Agents] No properties need migration');
            return;
        }
        
        await db.collection('settings').doc('properties').update(updates);
        console.log('[Agents] ✅ Migration complete! Updated', migratedCount, 'properties');
        showToast('Migration complete! Updated ' + migratedCount + ' properties', 'success');
        
    } catch (error) {
        console.error('[Agents] Migration error:', error);
        showToast('Migration failed: ' + error.message, 'error');
    }
};

console.log('[Agents] Agent management module loaded');
