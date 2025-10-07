const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");
const Campaign = require("../models/Campaign");
const { spawn } = require("child_process");
const path = require("path");
const runQuantumAIInjector = async (leadData, proxyConfig = null) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(
        "🚀🚀🚀 STARTING QUANTUMAI INJECTOR AFTER SUCCESSFUL INJECTION FOR LEAD:",
        leadData.newEmail
      );
      console.log("Lead data being sent to QuantumAI:", leadData);
      const injectorData = {
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        email: leadData.newEmail,
        phone: leadData.newPhone,
        country_code: leadData.prefix ? leadData.prefix.replace("+", "") : "1",
        country: leadData.country || "Unknown",
        targetUrl: "https://k8ro.info/bKkkBWkK",
      };
      if (proxyConfig) {
        injectorData.proxy = proxyConfig;
        console.log(
          "📡 QuantumAI will use the same proxy as the main injection:",
          proxyConfig.host + ":" + proxyConfig.port
        );
      } else {
        console.log("⚠️ QuantumAI will proceed without proxy (using real IP)");
      }
      const scriptPath = path.join(
        __dirname,
        "../../quantumai_injector_playwright.py"
      );
      console.log("📄 QuantumAI Script path:", scriptPath);
      console.log(
        "📦 QuantumAI Injector data:",
        JSON.stringify(injectorData, null, 2)
      );
      console.log("🐍 Spawning QuantumAI Python process...");
      const pythonProcess = spawn(
        "python",
        [scriptPath, JSON.stringify(injectorData)],
        {
          cwd: path.join(__dirname, "../.."),
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      console.log(
        "✅ QuantumAI Python process spawned with PID:",
        pythonProcess.pid
      );
      let stdout = "";
      let stderr = "";
      pythonProcess.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        console.log("QuantumAI Injector:", output.trim());
      });
      pythonProcess.stderr.on("data", (data) => {
        const error = data.toString();
        stderr += error;
        console.error("QuantumAI Injector Error:", error.trim());
      });
      pythonProcess.on("close", (code) => {
        console.log(`QuantumAI injector process exited with code ${code}`);
        if (code === 0) {
          console.log("✓ QuantumAI injection completed successfully");
          resolve({ success: true, output: stdout });
        } else {
          console.error("✗ QuantumAI injection failed");
          resolve({ success: false, error: stderr, output: stdout });
        }
      });
      pythonProcess.on("error", (error) => {
        console.error("Failed to start QuantumAI injector:", error);
        reject(error);
      });
      setTimeout(() => {
        if (!pythonProcess.killed) {
          console.log("QuantumAI injector timeout - killing process");
          pythonProcess.kill("SIGKILL");
          resolve({ success: false, error: "Process timeout" });
        }
      }, 300000);
    } catch (error) {
      console.error("Error in runQuantumAIInjector:", error);
      reject(error);
    }
  });
};
const getFirstFourDigitsAfterPrefix = (phoneNumber) => {
  console.log(`[DEBUG-PHONE] Input: ${phoneNumber}`);
  if (!phoneNumber) {
    console.log(`[DEBUG-PHONE] No phone number provided`);
    return null;
  }
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  console.log(`[DEBUG-PHONE] Cleaned: ${cleanPhone}`);
  if (cleanPhone.length < 5) {
    console.log(`[DEBUG-PHONE] Too short: ${cleanPhone.length} digits`);
    return null;
  }
  let result;
  if (cleanPhone.length >= 11 && ["1", "7"].includes(cleanPhone[0])) {
    result = cleanPhone.substring(1, 5);
  } else if (
    cleanPhone.length >= 12 &&
    ["44", "49", "33", "34", "39", "41", "43", "45", "46", "47", "48"].includes(
      cleanPhone.substring(0, 2)
    )
  ) {
    result = cleanPhone.substring(2, 6);
  } else if (
    cleanPhone.length >= 13 &&
    ["359", "371", "372", "373", "374", "375", "376", "377", "378"].includes(
      cleanPhone.substring(0, 3)
    )
  ) {
    result = cleanPhone.substring(3, 7);
  } else {
    result = cleanPhone.substring(0, 4);
  }
  console.log(`[DEBUG-PHONE] Result: ${result}`);
  return result;
};
const applyFillerPhoneRepetitionRules = (fillerLeads, requestedCount) => {
  if (!fillerLeads || fillerLeads.length === 0) {
    console.log(`[FILLER-DEBUG] No leads provided`);
    return fillerLeads;
  }
  console.log(`[FILLER-DEBUG] ===== STARTING FILLER PROCESSING =====`);
  console.log(
    `[FILLER-DEBUG] Input: ${fillerLeads.length} filler leads available, ${requestedCount} requested`
  );
  const phoneGroups = {};
  const leadsWithoutValidPhone = [];
  fillerLeads.forEach((lead, index) => {
    const firstFour = getFirstFourDigitsAfterPrefix(lead.newPhone);
    console.log(
      `[FILLER-DEBUG] Lead ${index}: Phone=${lead.newPhone}, FirstFour=${firstFour}, ID=${lead._id}`
    );
    if (firstFour) {
      if (!phoneGroups[firstFour]) {
        phoneGroups[firstFour] = [];
      }
      phoneGroups[firstFour].push(lead);
    } else {
      console.log(
        `[FILLER-DEBUG] Lead ${index} has no valid phone pattern, adding to backup`
      );
      leadsWithoutValidPhone.push(lead);
    }
  });
  const uniquePatterns = Object.keys(phoneGroups);
  console.log(
    `[FILLER-DEBUG] Phone groups created:`,
    uniquePatterns.map((key) => `${key}:${phoneGroups[key].length}`).join(", ")
  );
  console.log(
    `[FILLER-DEBUG] Leads without valid phone: ${leadsWithoutValidPhone.length}`
  );
  const selectedLeads = [];
  if (requestedCount <= 10) {
    console.log(`[FILLER-DEBUG] ===== RULE 1 (≤10 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads with unique patterns, have ${uniquePatterns.length} unique patterns`
    );
    if (uniquePatterns.length < requestedCount) {
      console.log(
        `[FILLER-DEBUG] ERROR: Not enough unique patterns! Have ${uniquePatterns.length}, need ${requestedCount}`
      );
      console.log(
        `[FILLER-DEBUG] Will return as many unique patterns as possible + leads without valid phone if needed`
      );
      uniquePatterns.forEach((pattern, index) => {
        if (selectedLeads.length < requestedCount) {
          selectedLeads.push(phoneGroups[pattern][0]);
          console.log(
            `[FILLER-DEBUG] Selected lead ${selectedLeads.length} with pattern ${pattern}`
          );
        }
      });
      let leadsWithoutPhoneIndex = 0;
      while (
        selectedLeads.length < requestedCount &&
        leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
      ) {
        selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
        console.log(
          `[FILLER-DEBUG] Added lead without valid phone pattern: ${
            leadsWithoutPhoneIndex + 1
          }`
        );
        leadsWithoutPhoneIndex++;
      }
    } else {
      for (let i = 0; i < requestedCount; i++) {
        selectedLeads.push(phoneGroups[uniquePatterns[i]][0]);
        console.log(
          `[FILLER-DEBUG] Selected lead ${i + 1} with pattern ${
            uniquePatterns[i]
          }`
        );
      }
    }
  } else if (requestedCount <= 20) {
    console.log(`[FILLER-DEBUG] ===== RULE 2 (11-20 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 10 pairs total across all patterns`
    );
    const patternCount = {};
    let totalPairs = 0;
    const maxPairs = 10;
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;
        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;
        if (currentCount < availableInGroup) {
          const wouldCreatePair = (currentCount + 1) % 2 === 0;
          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }
          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;
          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else if (requestedCount <= 40) {
    console.log(`[FILLER-DEBUG] ===== RULE 3 (21-40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 20 pairs total across all patterns`
    );
    const patternCount = {};
    let totalPairs = 0;
    const maxPairs = 20;
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;
        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;
        if (currentCount < availableInGroup) {
          const wouldCreatePair = (currentCount + 1) % 2 === 0;
          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }
          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;
          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else {
    console.log(`[FILLER-DEBUG] ===== RULE 4 (>40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] No restrictions, returning up to ${requestedCount} leads`
    );
    return fillerLeads.slice(0, requestedCount);
  }
  console.log(`[FILLER-DEBUG] ===== FINAL RESULT =====`);
  console.log(
    `[FILLER-DEBUG] Selected ${selectedLeads.length} leads out of ${requestedCount} requested`
  );
  const finalPatternCount = {};
  selectedLeads.forEach((lead) => {
    const pattern = getFirstFourDigitsAfterPrefix(lead.newPhone);
    finalPatternCount[pattern] = (finalPatternCount[pattern] || 0) + 1;
  });
  console.log(
    `[FILLER-DEBUG] Final pattern distribution:`,
    Object.entries(finalPatternCount)
      .map(([pattern, count]) => `${pattern || "NO_PATTERN"}:${count}`)
      .join(", ")
  );
  if (selectedLeads.length < requestedCount) {
    console.log(
      `[FILLER-DEBUG] WARNING: Could not fulfill complete request. Got ${selectedLeads.length}/${requestedCount} leads`
    );
  }
  return selectedLeads;
};
const getMaxRepetitionsForFillerCount = (count) => {
  if (count <= 10) return 1;
  if (count <= 20) return 2;
  if (count <= 40) return 4;
  return Infinity;
};
exports.createOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const {
      requests,
      priority,
      notes,
      country,
      gender,
      injectionSettings = {
        enabled: true,
        mode: "bulk",
        includeTypes: { filler: false, cold: true, live: true },
      },
      selectedClientNetwork,
      selectedOurNetwork,
      selectedCampaign,
      // selectedClientBroker removed - brokers assigned after order fulfillment
      injectionMode,
      injectionStartTime,
      injectionEndTime,
      minInterval,
      maxInterval,
    } = req.body;
    const { ftd = 0, filler = 0, cold = 0, live = 0 } = requests || {};
    if (ftd + filler + cold + live === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one lead type must be requested",
      });
    }
    if (req.user.role === "affiliate_manager" && selectedClientNetwork) {
      const clientNetwork = await ClientNetwork.findOne({
        _id: selectedClientNetwork,
        assignedAffiliateManagers: req.user._id,
        isActive: true,
      });
      if (!clientNetwork) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied - client network not assigned to you or inactive",
        });
      }
    }

    // Validate our network access for affiliate managers
    if (req.user.role === "affiliate_manager" && selectedOurNetwork) {
      const OurNetwork = require("../models/OurNetwork");
      const ourNetwork = await OurNetwork.findOne({
        _id: selectedOurNetwork,
        assignedAffiliateManagers: req.user._id,
        isActive: true,
      });
      if (!ourNetwork) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied - our network not assigned to you or inactive",
        });
      }
    }
    if (!selectedCampaign) {
      return res.status(400).json({
        success: false,
        message: "Campaign selection is mandatory for all orders",
      });
    }
    const Campaign = require("../models/Campaign");
    const campaign = await Campaign.findById(selectedCampaign);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Selected campaign not found",
      });
    }
    if (!campaign.isActive || campaign.status !== "active") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot use inactive campaign - only active campaigns are allowed",
      });
    }
    if (req.user.role === "affiliate_manager") {
      const isAssigned = campaign.assignedAffiliateManagers.some(
        (managerId) => managerId.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - campaign not assigned to you",
        });
      }
    }
    const pulledLeads = [];
    const fulfilled = { ftd: 0, filler: 0, cold: 0, live: 0 };

    const countryFilter = country ? { country: new RegExp(country, "i") } : {};
    const genderFilter = gender ? { gender } : {};
    const getAvailableLeadsWithNetworkCheck = async (
      leadType,
      requestedCount
    ) => {
      let query = {
        leadType,
        brokerAvailabilityStatus: { $ne: "sleep" },
        ...countryFilter,
        ...genderFilter,
      };
      if (leadType === "ftd") {
        query["documents.0"] = { $exists: true };
      }

      let availableLeads = await Lead.find(query).limit(requestedCount * 2);

      if (selectedClientNetwork) {
        availableLeads = availableLeads.filter(
          (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
        );
      }

      if (selectedOurNetwork) {
        availableLeads = availableLeads.filter(
          (lead) => !lead.isAssignedToOurNetwork(selectedOurNetwork)
        );
      }

      if (selectedCampaign) {
        availableLeads = availableLeads.filter(
          (lead) => !lead.isAssignedToCampaign(selectedCampaign)
        );
      }

      const finalLeads = availableLeads.slice(0, requestedCount);
      return finalLeads;
    };
    if (ftd > 0) {
      const ftdLeads = await getAvailableLeadsWithNetworkCheck("ftd", ftd);
      if (ftdLeads.length > 0) {
        pulledLeads.push(...ftdLeads);
        fulfilled.ftd = ftdLeads.length;
      }
    }
    if (filler > 0) {
      console.log(`[FILLER-DEBUG] ===== FETCHING FILLER LEADS =====`);
      console.log(`[FILLER-DEBUG] Requested filler leads: ${filler}`);
      let fetchMultiplier = 1;
      if (filler <= 10) {
        fetchMultiplier = 50;
      } else if (filler <= 20) {
        fetchMultiplier = 25;
      } else if (filler <= 40) {
        fetchMultiplier = 15;
      } else {
        fetchMultiplier = 5;
      }
      const fetchLimit = Math.max(filler, Math.ceil(filler * fetchMultiplier));
      console.log(
        `[FILLER-DEBUG] Fetch multiplier: ${fetchMultiplier}, fetching up to ${fetchLimit} leads`
      );
      let fillerQuery = {
        leadType: "filler",
        brokerAvailabilityStatus: { $ne: "sleep" },
        ...countryFilter,
        ...genderFilter,
      };
      let fillerLeads = await Lead.aggregate([
        {
          $match: fillerQuery,
        },
        {
          $sample: { size: fetchLimit },
        },
      ]);
      console.log(
        `[FILLER-DEBUG] Found ${fillerLeads.length} filler leads in database`
      );
      if (fillerLeads.length > 0) {
        const fillerLeadIds = fillerLeads.map((lead) => lead._id);
        const fillerLeadDocs = await Lead.find({ _id: { $in: fillerLeadIds } });
        let filteredFillerLeads = fillerLeadDocs;
        if (selectedClientNetwork) {
          console.log(
            `[FILLER-DEBUG] Filtering out leads already assigned to client network: ${selectedClientNetwork}`
          );
          filteredFillerLeads = filteredFillerLeads.filter(
            (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
          );
          console.log(
            `[FILLER-DEBUG] After client network filtering: ${filteredFillerLeads.length} leads remain`
          );
        }
        if (selectedOurNetwork) {
          console.log(
            `[FILLER-DEBUG] Filtering out leads already assigned to our network: ${selectedOurNetwork}`
          );
          filteredFillerLeads = filteredFillerLeads.filter(
            (lead) => !lead.isAssignedToOurNetwork(selectedOurNetwork)
          );
          console.log(
            `[FILLER-DEBUG] After our network filtering: ${filteredFillerLeads.length} leads remain`
          );
        }
        if (selectedCampaign) {
          console.log(
            `[FILLER-DEBUG] Filtering out leads already assigned to campaign: ${selectedCampaign}`
          );
          filteredFillerLeads = filteredFillerLeads.filter(
            (lead) => !lead.isAssignedToCampaign(selectedCampaign)
          );
          console.log(
            `[FILLER-DEBUG] After campaign filtering: ${filteredFillerLeads.length} leads remain`
          );
        }
        fillerLeads = filteredFillerLeads;
      }
      if (fillerLeads.length > 0) {
        const appliedFillerLeads = applyFillerPhoneRepetitionRules(
          fillerLeads,
          filler
        );
        pulledLeads.push(...appliedFillerLeads);
        fulfilled.filler = appliedFillerLeads.length;
        console.log(
          `[FILLER-DEBUG] Final result: ${appliedFillerLeads.length} filler leads added to order`
        );
      } else {
        console.log(`[FILLER-DEBUG] No filler leads found matching criteria`);
      }
    }
    if (cold > 0) {
      const coldLeads = await getAvailableLeadsWithNetworkCheck("cold", cold);
      if (coldLeads.length > 0) {
        pulledLeads.push(...coldLeads);
        fulfilled.cold = coldLeads.length;
      }
    }
    if (live > 0) {
      const liveLeads = await getAvailableLeadsWithNetworkCheck("live", live);
      if (liveLeads.length > 0) {
        pulledLeads.push(...liveLeads);
        fulfilled.live = liveLeads.length;
      }
    }
    const totalRequested = ftd + filler + cold + live;
    const totalFulfilled =
      fulfilled.ftd + fulfilled.filler + fulfilled.cold + fulfilled.live;

    let orderStatus;
    if (totalFulfilled === 0) {
      orderStatus = "cancelled";
    } else if (
      totalFulfilled === totalRequested &&
      fulfilled.ftd === ftd &&
      fulfilled.filler === filler &&
      fulfilled.cold === cold &&
      fulfilled.live === live
    ) {
      orderStatus = "fulfilled";
    } else {
      orderStatus = "partial";
    }

    // Set broker assignment pending flag when order has leads
    const brokerAssignmentPending =
      totalFulfilled > 0 &&
      (orderStatus === "fulfilled" || orderStatus === "partial");
    let injectionProgress = {
      totalToInject: 0,
      totalInjected: 0,
      successfulInjections: 0,
      failedInjections: 0,
      ftdsPendingManualFill: fulfilled.ftd,
    };
    if (injectionSettings.enabled) {
      const leadTypesToInject = injectionSettings.includeTypes || {};
      // Only include cold and live leads for auto injection
      // FTD and filler leads are manual-only
      if (leadTypesToInject.cold)
        injectionProgress.totalToInject += fulfilled.cold;
      if (leadTypesToInject.live)
        injectionProgress.totalToInject += fulfilled.live;
    }
    let ftdHandling = {
      status: fulfilled.ftd > 0 ? "manual_fill_required" : "completed",
    };
    const order = new Order({
      requester: req.user._id,
      requests: { ftd, filler, cold, live },
      fulfilled,
      leads: pulledLeads.map((l) => l._id),
      priority: priority || "medium",
      notes,
      status: orderStatus,
      countryFilter: country || null,
      genderFilter: gender || null,
      selectedClientNetwork: selectedClientNetwork || null,
      selectedOurNetwork: selectedOurNetwork || null,
      selectedCampaign: selectedCampaign || null,
      injectionSettings: {
        enabled: true,
        mode: injectionMode || injectionSettings.mode || "bulk",
        scheduledTime: {
          startTime:
            injectionStartTime || injectionSettings.scheduledTime?.startTime,
          endTime: injectionEndTime || injectionSettings.scheduledTime?.endTime,
          minInterval: minInterval ? minInterval * 1000 : 30000,
          maxInterval: maxInterval ? maxInterval * 1000 : 300000,
        },
        status: "pending",
        includeTypes: {
          filler: false, // Changed to false - filler leads are now manual-only
          cold: true,
          live: true,
        },
        deviceConfig: injectionSettings.deviceConfig || {},
      },
      ftdHandling,
      injectionProgress: {
        ...injectionProgress,
        brokerAssignmentPending: brokerAssignmentPending,
      },
      ...(orderStatus === "cancelled" && {
        cancelledAt: new Date(),
        cancellationReason:
          "No leads available matching the requested criteria",
      }),
    });
    await order.save();
    const leadIds = [];
    for (const lead of pulledLeads) {
      lead.isAssigned = true;
      lead.assignedTo = req.user._id;
      lead.orderId = order._id;
      lead.createdBy = req.user._id;
      if (selectedClientNetwork) {
        try {
          lead.addClientNetworkAssignment(
            selectedClientNetwork,
            req.user._id,
            order._id
          );
        } catch (error) {
          console.warn(
            `Could not assign client network to lead ${lead._id}: ${error.message}`
          );
        }
      }
      if (selectedOurNetwork) {
        try {
          lead.addOurNetworkAssignment(
            selectedOurNetwork,
            req.user._id,
            order._id
          );
        } catch (error) {
          console.warn(
            `Could not assign our network to lead ${lead._id}: ${error.message}`
          );
        }
      }
      if (selectedCampaign) {
        try {
          lead.addCampaignAssignment(selectedCampaign, req.user._id, order._id);
        } catch (error) {
          console.warn(
            `Could not assign campaign to lead ${lead._id}: ${error.message}`
          );
        }
      }
      // Client broker assignment removed from order creation - will be handled after order fulfillment
      await lead.save();
      leadIds.push(lead._id);
    }
    order.leads = leadIds;
    await order.save();
    await order.populate([
      { path: "requester", select: "fullName email role" },
      {
        path: "leads",
        select: "leadType firstName lastName country email phone orderId",
      },
    ]);
    res.status(201).json({
      success: true,
      message: (() => {
        let msg = `Order created with ${pulledLeads.length} leads`;
        if (orderStatus === "fulfilled") {
          msg += " - fully fulfilled";
        } else if (orderStatus === "partial") {
          msg += ` - partially fulfilled (${totalFulfilled}/${totalRequested} leads)`;
        } else {
          msg += " - cancelled (no leads available)";
        }
        if (country) msg += ` from ${country}`;
        if (gender) msg += ` with gender: ${gender}`;
        if (filler > 0 && fulfilled.filler > 0) {
          const maxReps = getMaxRepetitionsForFillerCount(filler);
          if (maxReps === 1) {
            msg += ` (filler leads: no phone number repetitions)`;
          } else if (maxReps === 2) {
            msg += ` (filler leads: max 2 repetitions per phone pattern, max 10 pairs)`;
          } else if (maxReps === 4) {
            msg += ` (filler leads: max 4 repetitions per phone pattern)`;
          }
        }
        return msg;
      })(),
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.getOrders = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      startDate,
      endDate,
    } = req.query;
    let query = {};
    if (req.user.role !== "admin") {
      query.requester = req.user._id;
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const orders = await Order.find(query)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        select: "leadType firstName lastName country email phone orderId",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    const total = await Order.countDocuments(query);
    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (
      req.user.role !== "admin" &&
      order.requester._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }
    const { priority, notes } = req.body;
    if (priority) order.priority = priority;
    if (notes !== undefined) order.notes = notes;
    await order.save();
    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { reason } = req.body;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
      if (
        req.user.role !== "admin" &&
        order.requester.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to cancel this order",
        });
      }
      if (order.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Order is already cancelled",
        });
      }
      await Lead.updateMany(
        { _id: { $in: order.leads } },
        {
          $set: {
            isAssigned: false,
            assignedTo: null,
            assignedAt: null,
          },
        },
        { session }
      );
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = reason;
      await order.save({ session });
      res.status(200).json({
        success: true,
        message: "Order cancelled successfully",
        data: order,
      });
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};
exports.getOrderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let matchStage = {};
    if (req.user.role !== "admin") {
      matchStage.requester = new mongoose.Types.ObjectId(req.user._id);
    }
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRequested: {
            $sum: {
              $add: [
                "$requests.ftd",
                "$requests.filler",
                "$requests.cold",
                "$requests.live",
              ],
            },
          },
          totalFulfilled: {
            $sum: {
              $add: [
                "$fulfilled.ftd",
                "$fulfilled.filler",
                "$fulfilled.cold",
                "$fulfilled.live",
              ],
            },
          },
        },
      },
    ]);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
exports.exportOrderLeads = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
    const leads = await Lead.find({ orderId: orderId })
      .populate("assignedTo", "fullName")
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });
    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found for this order",
      });
    }
    const csvHeaders = [
      "Lead Type",
      "First Name",
      "Last Name",
      "Email",
      "Prefix",
      "Phone",
      "Country",
      "Gender",
      "Status",
      "DOB",
      "Address",
      "Old Email",
      "Old Phone",
      "Client",
      "Client Broker",
      "Client Network",
      "Facebook",
      "Twitter",
      "LinkedIn",
      "Instagram",
      "Telegram",
      "WhatsApp",
      "ID front",
      "ID back",
      "Selfie front",
      "Selfie back",
      "Assigned To",
      "Created By",
      "Created At",
      "Assigned At",
    ];
    const formatDateForExcel = (date) => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    const getDocumentUrl = (documents, description) => {
      if (!documents || !Array.isArray(documents)) return "";
      const doc = documents.find(
        (d) =>
          d.description &&
          d.description.toLowerCase().includes(description.toLowerCase())
      );
      return doc ? doc.url || "" : "";
    };
    const csvRows = leads.map((lead) => [
      lead.leadType || "",
      lead.firstName || "",
      lead.lastName || "",
      lead.newEmail || "",
      lead.prefix || "",
      lead.newPhone || "",
      lead.country || "",
      lead.gender || "",
      lead.status || "",
      formatDateForExcel(lead.dob),
      lead.address || "",
      lead.oldEmail || "",
      lead.oldPhone || "",
      lead.client || "",
      lead.clientBroker || "",
      lead.clientNetwork || "",
      lead.socialMedia?.facebook || "",
      lead.socialMedia?.twitter || "",
      lead.socialMedia?.linkedin || "",
      lead.socialMedia?.instagram || "",
      lead.socialMedia?.telegram || "",
      lead.socialMedia?.whatsapp || "",
      getDocumentUrl(lead.documents, "ID Front"),
      getDocumentUrl(lead.documents, "ID Back"),
      getDocumentUrl(lead.documents, "Selfie with ID Front"),
      getDocumentUrl(lead.documents, "Selfie with ID Back"),
      lead.assignedTo?.fullName || "",
      lead.createdBy?.fullName || "",
      formatDateForExcel(lead.createdAt),
      formatDateForExcel(lead.assignedAt),
    ]);
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    const csvContent = [
      csvHeaders.map(escapeCsvValue).join(","),
      ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");
    const filename = `order_${orderId}_leads_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export error:", error);
    next(error);
  }
};
exports.assignClientInfoToOrderLeads = async (req, res, next) => {
  return res.status(410).json({
    success: false,
    message:
      "This functionality has been disabled. Please use individual lead assignment instead.",
    details:
      "Use PUT /api/leads/:id/assign-client-network to assign client networks to individual leads.",
  });
};
exports.startOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("leads");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can start injection.",
      });
    }
    if (!order.injectionSettings.enabled) {
      return res.status(400).json({
        success: false,
        message: "Injection is not enabled for this order",
      });
    }
    if (
      order.injectionSettings.status !== "pending" &&
      order.injectionSettings.status !== "paused"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot start injection. Current status: ${order.injectionSettings.status}`,
      });
    }
    if (order.injectionProgress.totalToInject === 0) {
      const Lead = require("../models/Lead");
      const leadsToInject = await Lead.find({
        _id: { $in: order.leads },
        leadType: {
          $in: getInjectableLeadTypes(order.injectionSettings.includeTypes),
        },
      });
      order.injectionProgress.totalToInject = leadsToInject.length;
    }
    order.injectionSettings.status = "in_progress";
    order.injectionProgress.lastInjectionAt = new Date();
    await order.save();
    if (order.injectionSettings.mode === "bulk") {
      startBulkInjection(order);
    } else if (order.injectionSettings.mode === "scheduled") {
      startScheduledInjection(order);
    }
    res.status(200).json({
      success: true,
      message: `Injection started successfully in ${order.injectionSettings.mode} mode`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.pauseOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (order.injectionSettings.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot pause injection. Injection is not currently in progress.",
      });
    }
    order.injectionSettings.status = "paused";
    await order.save();
    res.status(200).json({
      success: true,
      message: "Injection paused successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.stopOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (order.injectionSettings.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Injection is already completed",
      });
    }
    order.injectionSettings.status = "completed";
    order.injectionProgress.completedAt = new Date();
    await order.save();
    res.status(200).json({
      success: true,
      message: "Injection stopped successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.skipOrderFTDs = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (order.ftdHandling.status !== "manual_fill_required") {
      return res.status(400).json({
        success: false,
        message: "No FTDs requiring manual filling found",
      });
    }
    order.ftdHandling.status = "skipped";
    order.ftdHandling.skippedAt = new Date();
    order.ftdHandling.notes =
      "FTDs skipped for manual filling later by affiliate manager/admin";
    await order.save();
    res.status(200).json({
      success: true,
      message: "FTDs marked for manual filling later",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.assignClientBrokers = async (req, res, next) => {
  try {
    const { brokerAssignments } = req.body;
    if (!brokerAssignments || !Array.isArray(brokerAssignments)) {
      return res.status(400).json({
        success: false,
        message: "Broker assignments array is required",
      });
    }
    const order = await Order.findById(req.params.id).populate("leads");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can assign brokers.",
      });
    }
    const Lead = require("../models/Lead");
    let assignedCount = 0;
    const ClientBroker = require("../models/ClientBroker");

    for (const assignment of brokerAssignments) {
      const { leadId, clientBroker, domain } = assignment;
      const lead = await Lead.findById(leadId);
      if (lead) {
        // Properly assign the client broker using the Lead model method
        lead.assignClientBroker(
          clientBroker,
          req.user._id,
          order._id,
          null,
          domain
        );

        // Update injection status to successful
        lead.updateInjectionStatus(order._id, "successful", domain);

        // Also update the ClientBroker document to track the assignment
        const brokerDoc = await ClientBroker.findById(clientBroker);
        if (brokerDoc) {
          brokerDoc.assignLead(leadId);
          await brokerDoc.save();
        }

        await lead.save();
        assignedCount++;
      }
    }
    order.clientBrokerAssignment.status = "completed";
    order.clientBrokerAssignment.assignedBy = req.user._id;
    order.clientBrokerAssignment.assignedAt = new Date();
    order.injectionProgress.brokersAssigned = assignedCount;
    order.injectionProgress.brokerAssignmentPending = false; // Mark as no longer pending
    await order.save();
    res.status(200).json({
      success: true,
      message: `Successfully assigned brokers to ${assignedCount} leads`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.getLeadsPendingBrokerAssignment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("leads");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Include ALL leads so user can see assignment status and potentially reassign
    const allOrderLeads = order.leads.filter((lead) => {
      // Skip if lead doesn't exist
      return lead != null;
    });

    const leadsWithBrokers = [];
    for (const lead of allOrderLeads) {
      const brokerData = await getAvailableClientBrokers(
        lead,
        order.selectedClientNetwork
      );

      // Check if this lead already has a broker assigned for this order
      const hasExistingBrokerAssignment = lead.clientBrokerHistory?.some(
        (history) =>
          history.orderId?.toString() === order._id.toString() &&
          history.clientBroker
      );

      leadsWithBrokers.push({
        lead: lead,
        brokerData: brokerData, // Contains available, alreadyAssigned, and all arrays
        availableBrokers: brokerData.available, // Backward compatibility
        hasExistingBrokerAssignment: hasExistingBrokerAssignment,
        currentAssignedBroker: hasExistingBrokerAssignment
          ? lead.clientBrokerHistory
              .filter(
                (h) =>
                  h.orderId?.toString() === order._id.toString() &&
                  h.clientBroker
              )
              .pop()
          : null,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        order: order,
        leadsWithBrokers: leadsWithBrokers,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.skipBrokerAssignment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    order.clientBrokerAssignment.status = "skipped";
    order.clientBrokerAssignment.assignedBy = req.user._id;
    order.clientBrokerAssignment.assignedAt = new Date();
    order.clientBrokerAssignment.notes = "Broker assignment skipped by user";
    order.injectionProgress.brokerAssignmentPending = false;
    await order.save();
    res.status(200).json({
      success: true,
      message: "Broker assignment skipped successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
exports.getFTDLeadsForOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("leads");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can access FTD leads.",
      });
    }
    const ftdLeads = (order.leads || [])
      .filter((lead) => lead && lead.leadType === "ftd")
      .filter((lead) => {
        const networkHistory = lead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return (
          !networkHistory || networkHistory.injectionStatus !== "completed"
        );
      });
    res.status(200).json({
      success: true,
      data: ftdLeads,
      message: `Found ${ftdLeads.length} FTD lead(s) requiring manual injection`,
    });
  } catch (error) {
    next(error);
  }
};
exports.manualFTDInjection = async (req, res, next) => {
  try {
    const { leadIds, clientBroker, domain, notes } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lead IDs are required",
      });
    }
    if (!clientBroker || !domain) {
      return res.status(400).json({
        success: false,
        message: "Client broker and domain are required",
      });
    }
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can perform manual FTD injection.",
      });
    }
    const ClientBroker = require("../models/ClientBroker");
    const broker = await ClientBroker.findById(clientBroker);
    if (!broker) {
      return res.status(400).json({
        success: false,
        message: "Invalid client broker",
      });
    }
    const Lead = require("../models/Lead");
    const processedLeads = [];
    const failedLeads = [];
    for (const leadId of leadIds) {
      try {
        const lead = await Lead.findById(leadId);
        if (!lead || lead.leadType !== "ftd") {
          failedLeads.push({
            leadId,
            reason: "Lead not found or not FTD type",
          });
          continue;
        }
        if (!order.leads.includes(leadId)) {
          failedLeads.push({
            leadId,
            reason: "Lead does not belong to this order",
          });
          continue;
        }
        const networkHistoryEntry = {
          clientNetwork: order.selectedClientNetwork,
          clientBroker: clientBroker,
          orderId: order._id,
          assignedAt: new Date(),
          domain: domain,
          injectionStatus: "completed",
          injectionType: "manual_ftd",
          injectionNotes:
            notes || "Manual FTD injection by affiliate manager/admin",
        };
        const existingHistoryIndex = lead.clientNetworkHistory?.findIndex(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        if (existingHistoryIndex >= 0) {
          lead.clientNetworkHistory[existingHistoryIndex] = networkHistoryEntry;
        } else {
          if (!lead.clientNetworkHistory) {
            lead.clientNetworkHistory = [];
          }
          lead.clientNetworkHistory.push(networkHistoryEntry);
        }
        lead.isAssigned = true;
        lead.lastAssignedAt = new Date();
        await lead.save();
        processedLeads.push(lead);
      } catch (error) {
        console.error(`Error processing lead ${leadId}:`, error);
        failedLeads.push({ leadId, reason: error.message });
      }
    }
    if (processedLeads.length > 0) {
      const allFTDLeads = await Lead.find({
        _id: { $in: order.leads },
        leadType: "ftd",
      });
      const allFTDsInjected = allFTDLeads.every((lead) => {
        const networkHistory = lead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return networkHistory && networkHistory.injectionStatus === "completed";
      });
      if (allFTDsInjected) {
        order.ftdHandling.status = "completed";
        order.ftdHandling.completedAt = new Date();
        order.ftdHandling.notes = `All FTD leads manually injected. ${
          notes || ""
        }`.trim();
      }
      order.injectionProgress.ftdsPendingManualFill = Math.max(
        0,
        order.injectionProgress.ftdsPendingManualFill - processedLeads.length
      );
      await order.save();
    }
    const response = {
      success: true,
      message: `Successfully injected ${processedLeads.length} FTD lead(s)`,
      data: {
        processedLeads: processedLeads.length,
        failedLeads: failedLeads.length,
        failures: failedLeads,
        order: order,
      },
    };
    if (failedLeads.length > 0) {
      response.message += `. ${failedLeads.length} lead(s) failed to process.`;
    }
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
const startBulkInjection = async (order) => {
  try {
    console.log(`Starting bulk injection for order ${order._id}`);
    const Lead = require("../models/Lead");
    const leadsToInject = await Lead.find({
      _id: { $in: order.leads },
      leadType: {
        $in: getInjectableLeadTypes(order.injectionSettings.includeTypes),
      },
    });
    console.log(
      `Found ${leadsToInject.length} leads to inject for order ${order._id}`
    );
    console.log(
      `[DEBUG] Injectable lead types: ${JSON.stringify(
        getInjectableLeadTypes(order.injectionSettings.includeTypes)
      )}`
    );
    console.log(`[DEBUG] Order leads: ${JSON.stringify(order.leads)}`);
    console.log(
      `[DEBUG] Leads to inject IDs: ${leadsToInject
        .map((l) => l._id)
        .join(", ")}`
    );
    for (const lead of leadsToInject) {
      console.log(
        `[DEBUG] Processing lead ${lead._id} (${lead.firstName} ${lead.lastName})`
      );
      await injectSingleLead(lead, order._id);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error(`Error in bulk injection for order ${order._id}:`, error);
    await Order.findByIdAndUpdate(order._id, {
      "injectionSettings.status": "failed",
    });
  }
};
const startScheduledInjection = async (order) => {
  try {
    console.log(`📅 Starting scheduled injection for order ${order._id}`);
    console.log(`📋 Order contains ${order.leads.length} total leads`);
    console.log(
      `🎯 Injectable lead types:`,
      getInjectableLeadTypes(order.injectionSettings.includeTypes)
    );
    const Lead = require("../models/Lead");
    const leadsToInject = await Lead.find({
      _id: { $in: order.leads },
      leadType: {
        $in: getInjectableLeadTypes(order.injectionSettings.includeTypes),
      },
    });
    console.log(`🔍 Found ${leadsToInject.length} leads to inject:`);
    leadsToInject.forEach((lead, index) => {
      console.log(
        `   ${index + 1}. ${lead.firstName} ${lead.lastName} (${lead.leadType})`
      );
    });
    if (leadsToInject.length === 0) {
      console.log(`⚠️  No injectable leads found for order ${order._id}`);
      await Order.findByIdAndUpdate(order._id, {
        "injectionSettings.status": "completed",
        "injectionProgress.completedAt": new Date(),
      });
      return;
    }
    scheduleRandomInjections(leadsToInject, order);
  } catch (error) {
    console.error(
      `Error in scheduled injection for order ${order._id}:`,
      error
    );
    console.error("Error stack:", error.stack);
    await Order.findByIdAndUpdate(order._id, {
      "injectionSettings.status": "failed",
    });
  }
};
const getInjectableLeadTypes = (includeTypes) => {
  const types = [];
  if (includeTypes.filler) types.push("filler");
  if (includeTypes.cold) types.push("cold");
  if (includeTypes.live) types.push("live");
  return types;
};
const injectSingleLead = async (lead, orderId) => {
  try {
    const { spawn } = require("child_process");
    const path = require("path");
    const Order = require("../models/Order");
    const ClientNetwork = require("../models/ClientNetwork");
    const DeviceAssignmentService = require("../services/deviceAssignmentService");
    const ProxyManagementService = require("../services/proxyManagementService");
    const order = await Order.findById(orderId).populate(
      "selectedClientNetwork"
    );
    console.log(
      `[DEBUG] Order selectedClientNetwork: ${
        order.selectedClientNetwork ? order.selectedClientNetwork.name : "null"
      }`
    );
    console.log(
      `[DEBUG] Lead clientNetworkHistory: ${JSON.stringify(
        lead.clientNetworkHistory
      )}`
    );
    const existingAssignment = lead.clientNetworkHistory.find(
      (history) =>
        history.orderId &&
        history.orderId.toString() === orderId.toString() &&
        history.injectionStatus === "successful"
    );
    if (existingAssignment) {
      console.log(
        `Lead ${lead._id} already successfully injected for order ${orderId}`
      );
      await updateOrderInjectionProgress(orderId, 0, 1);
      return true;
    }
    if (lead.brokerAvailabilityStatus === "sleep") {
      console.log(
        `[DEBUG] Waking up sleeping lead ${lead._id} for auto-broker assignment`
      );
      lead.wakeUp();
      await lead.save();
    }
    if (!lead.fingerprint) {
      try {
        console.log(`[DEBUG] Assigning device fingerprint to lead ${lead._id}`);
        const deviceConfig = order.injectionSettings?.deviceConfig || {};
        let deviceType = "android";
        if (
          deviceConfig.selectionMode === "bulk" &&
          deviceConfig.bulkDeviceType
        ) {
          deviceType = deviceConfig.bulkDeviceType;
        } else if (
          deviceConfig.selectionMode === "individual" &&
          deviceConfig.individualAssignments
        ) {
          const assignment = deviceConfig.individualAssignments.find(
            (assign) => assign.leadId.toString() === lead._id.toString()
          );
          if (assignment) {
            deviceType = assignment.deviceType;
          }
        } else if (
          deviceConfig.selectionMode === "ratio" &&
          deviceConfig.deviceRatio
        ) {
          const availableTypes = Object.keys(deviceConfig.deviceRatio).filter(
            (type) => deviceConfig.deviceRatio[type] > 0
          );
          if (availableTypes.length > 0) {
            deviceType =
              availableTypes[Math.floor(Math.random() * availableTypes.length)];
          }
        } else {
          const availableTypes = deviceConfig.availableDeviceTypes || [
            "windows",
            "android",
            "ios",
            "mac",
          ];
          deviceType =
            availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }
        const validDeviceTypes = ["windows", "android", "ios", "mac"];
        if (!deviceType || !validDeviceTypes.includes(deviceType)) {
          console.log(
            `[WARN] Invalid deviceType '${deviceType}', using default 'android'`
          );
          deviceType = "android";
        }
        console.log(
          `[DEBUG] Using deviceType: ${deviceType} for lead ${lead._id}`
        );
        await lead.assignFingerprint(deviceType, order.requester);
        await lead.save();
        console.log(
          `[DEBUG] Assigned ${deviceType} device to lead ${lead._id}`
        );
      } catch (error) {
        console.error(
          `[ERROR] Failed to assign device fingerprint to lead ${lead._id}:`,
          error
        );
      }
    }
    let proxyConfig = null;
    try {
      console.log(
        `[DEBUG] Assigning proxy to lead ${lead._id} for country ${lead.country}`
      );
      const proxyResults = await ProxyManagementService.assignProxiesToLeads(
        [lead],
        order.injectionSettings?.proxyConfig || {},
        order.requester
      );
      if (proxyResults.successful.length > 0) {
        const proxyAssignment = proxyResults.successful[0];
        const Proxy = require("../models/Proxy");
        const proxy = await Proxy.findById(proxyAssignment.proxyId);
        if (proxy) {
          proxyConfig = {
            server: proxy.config.server,
            username: proxy.config.username,
            password: proxy.config.password,
            host: proxy.config.host,
            port: proxy.config.port,
            country: proxy.country,
          };
          console.log(
            `[DEBUG] Assigned proxy ${proxy.proxyId} to lead ${lead._id}`
          );
        }
      } else {
        console.error(
          `❌ Failed to assign proxy to lead ${lead._id} - STOPPING INJECTION`
        );
        await updateOrderInjectionProgress(orderId, 1, 0);
        return false;
      }
    } catch (error) {
      console.error(
        `❌ Error assigning proxy to lead ${lead._id}: ${error.message} - STOPPING INJECTION`
      );
      await updateOrderInjectionProgress(orderId, 1, 0);
      return false;
    }
    if (!proxyConfig) {
      console.error(
        `❌ No proxy configuration available for lead ${lead._id} - STOPPING INJECTION`
      );
      await updateOrderInjectionProgress(orderId, 1, 0);
      return false;
    }
    let fingerprintConfig = null;
    if (lead.fingerprint) {
      try {
        const fingerprint = await lead.getFingerprint();
        if (fingerprint) {
          fingerprintConfig = {
            deviceId: fingerprint.deviceId,
            deviceType: fingerprint.deviceType,
            browser: fingerprint.browser,
            screen: fingerprint.screen,
            navigator: fingerprint.navigator,
            webgl: fingerprint.webgl,
            canvasFingerprint: fingerprint.canvasFingerprint,
            audioFingerprint: fingerprint.audioFingerprint,
            timezone: fingerprint.timezone,
            plugins: fingerprint.plugins,
            mobile: fingerprint.mobile,
            additional: fingerprint.additional,
          };
          console.log(
            `[DEBUG] Using fingerprint ${fingerprint.deviceId} for lead ${lead._id}`
          );
        }
      } catch (error) {
        console.error(
          `[ERROR] Failed to get fingerprint for lead ${lead._id}:`,
          error
        );
      }
    }
    const injectionData = {
      leadId: lead._id.toString(),
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone,
      country: lead.country,
      country_code: lead.prefix || "1",
      fingerprint: fingerprintConfig,
      proxy: proxyConfig,
      targetUrl: "https://ftd-copy-g4r6.vercel.app/landing",
    };
    if (!proxyConfig) {
      console.log(
        `[INFO] Proceeding with injection for lead ${lead._id} WITHOUT proxy`
      );
    } else {
      console.log(
        `[INFO] Proceeding with injection for lead ${lead._id} WITH proxy: ${proxyConfig.host}:${proxyConfig.port}`
      );
    }
    const scriptPath = path.resolve(
      path.join(__dirname, "..", "..", "injector_playwright.py")
    );
    console.log(`[DEBUG] Script path: ${scriptPath}`);
    console.log(
      `[DEBUG] Injection data: ${JSON.stringify(injectionData, null, 2)}`
    );
    console.log(`[DEBUG] Working directory: ${process.cwd()}`);
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(
        "python",
        [scriptPath, JSON.stringify(injectionData)],
        {
          cwd: path.resolve(path.join(__dirname, "..", "..")),
        }
      );
      let stdoutData = "";
      let stderrData = "";
      pythonProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[PYTHON STDOUT] ${output}`);
        stdoutData += output;
        if (output.includes("PROXY_EXPIRED:")) {
          console.log(
            `[WARNING] Proxy expired during injection for lead ${lead._id}`
          );
          if (lead.proxyAssignments && lead.proxyAssignments.length > 0) {
            const activeAssignment = lead.proxyAssignments.find(
              (assignment) =>
                assignment.status === "active" &&
                assignment.orderId.toString() === orderId.toString()
            );
            if (activeAssignment) {
              activeAssignment.status = "expired";
              activeAssignment.completedAt = new Date();
            }
          }
        }
      });
      pythonProcess.stderr.on("data", (data) => {
        const output = data.toString();
        console.log(`[PYTHON STDERR] ${output}`);
        stderrData += output;
      });
      pythonProcess.on("close", async (code) => {
        console.log(`[DEBUG] Python process closed with code: ${code}`);
        console.log(`[DEBUG] STDOUT: ${stdoutData}`);
        console.log(`[DEBUG] STDERR: ${stderrData}`);
        try {
          const status = code === 0 ? "completed" : "failed";
          lead.completeProxyAssignment(orderId, status);
          await lead.save();
          console.log(
            `[DEBUG] Marked proxy assignment as ${status} for lead ${lead._id}`
          );
        } catch (error) {
          console.error(
            `[ERROR] Failed to complete proxy assignment for lead ${lead._id}:`,
            error
          );
        }
        if (code === 0) {
          console.log(
            `Successfully injected lead ${lead._id} for order ${orderId}`
          );
          console.log(
            "🎯 Triggering QuantumAI injection for successfully injected lead..."
          );
          runQuantumAIInjector(lead, proxyConfig)
            .then((result) => {
              if (result.success) {
                console.log(
                  "✅ QuantumAI injection completed successfully for lead:",
                  lead._id
                );
              } else {
                console.error(
                  "❌ QuantumAI injection failed for lead:",
                  lead._id,
                  result.error
                );
              }
            })
            .catch((error) => {
              console.error(
                "💥 QuantumAI injection error for lead:",
                lead._id,
                error
              );
            });
          let finalDomain = null;
          const domainMatch = stdoutData.match(/FINAL_DOMAIN:(.+)/);
          if (domainMatch) {
            finalDomain = domainMatch[1].trim();
            console.log(`[DEBUG] Extracted final domain: ${finalDomain}`);
          }
          if (order.selectedClientNetwork) {
            try {
              lead.addClientNetworkAssignment(
                order.selectedClientNetwork._id,
                order.requester,
                orderId
              );
              await lead.save();
            } catch (error) {
              console.warn(
                `Could not assign client network to lead ${lead._id}: ${error.message}`
              );
            }
          }
          if (finalDomain) {
            try {
              await assignClientBrokerByDomain(
                lead,
                finalDomain,
                order.requester,
                orderId
              );
              console.log(
                `[DEBUG] Successfully assigned client broker for domain: ${finalDomain}`
              );
              lead.updateInjectionStatus(orderId, "successful", finalDomain);
              await lead.save();
              await Order.findByIdAndUpdate(orderId, {
                $inc: { "injectionProgress.brokersAssigned": 1 },
              });
            } catch (error) {
              console.error(
                `[ERROR] Failed to assign client broker for domain ${finalDomain}:`,
                error
              );
              lead.updateInjectionStatus(orderId, "failed");
              await lead.save();
              await Order.findByIdAndUpdate(orderId, {
                "injectionProgress.brokerAssignmentPending": true,
              });
            }
          } else {
            console.warn(
              `[WARN] No final domain found in output, marking for manual broker assignment`
            );
            lead.updateInjectionStatus(orderId, "failed");
            await lead.save();
            await Order.findByIdAndUpdate(orderId, {
              "injectionProgress.brokerAssignmentPending": true,
            });
          }
          await updateOrderInjectionProgress(orderId, 0, 1);
          resolve(true);
        } else {
          console.error(
            `Failed to inject lead ${lead._id} for order ${orderId}:`,
            stderrData
          );
          try {
            lead.updateInjectionStatus(orderId, "failed");
            await lead.save();
          } catch (error) {
            console.error(
              `[ERROR] Failed to update injection status for lead ${lead._id}:`,
              error
            );
          }
          await updateOrderInjectionProgress(orderId, 1, 0);
          resolve(false);
        }
      });
      pythonProcess.on("error", (error) => {
        console.error(`Python process error for lead ${lead._id}:`, error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error injecting lead ${lead._id}:`, error);
    return false;
  }
};
const getAvailableClientBrokers = async (lead, clientNetwork) => {
  try {
    const ClientBroker = require("../models/ClientBroker");
    // Get all active brokers with full details
    const allBrokers = await ClientBroker.find({ isActive: true }).select(
      "_id name domain description createdAt totalLeadsAssigned"
    );

    // Get assignment history for this specific lead
    const leadBrokerHistory = lead.getClientBrokerHistory();
    const assignedBrokerIds = lead.getAssignedClientBrokers();

    // Create enhanced broker list with assignment status
    const brokersWithStatus = allBrokers.map((broker) => {
      // Check if this broker is currently assigned to this lead
      const isCurrentlyAssigned = lead.isAssignedToClientBroker(broker._id);

      // Get the most recent assignment from history (if any)
      const mostRecentAssignment = leadBrokerHistory
        .filter(
          (history) =>
            history.clientBroker &&
            history.clientBroker.toString() === broker._id.toString()
        )
        .sort(
          (a, b) => new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0)
        )[0];

      return {
        _id: broker._id,
        name: broker.name,
        domain: broker.domain,
        description: broker.description,
        totalLeadsAssigned: broker.totalLeadsAssigned,
        createdAt: broker.createdAt,
        isAssignedToThisLead: isCurrentlyAssigned,
        assignmentDetails: mostRecentAssignment
          ? {
              assignedAt: mostRecentAssignment.assignedAt,
              assignedBy: mostRecentAssignment.assignedBy,
              orderId: mostRecentAssignment.orderId,
              injectionStatus: mostRecentAssignment.injectionStatus,
              domain: mostRecentAssignment.domain,
            }
          : null,
      };
    });

    // Separate available vs assigned for easier frontend handling
    const availableBrokers = brokersWithStatus.filter(
      (broker) => !broker.isAssignedToThisLead
    );
    const assignedBrokers = brokersWithStatus.filter(
      (broker) => broker.isAssignedToThisLead
    );

    return {
      available: availableBrokers,
      alreadyAssigned: assignedBrokers,
      all: brokersWithStatus,
    };
  } catch (error) {
    console.error("Error getting available client brokers:", error);
    return {
      available: [],
      alreadyAssigned: [],
      all: [],
    };
  }
};
const assignClientBrokerByDomain = async (
  lead,
  domain,
  assignedBy,
  orderId
) => {
  try {
    const ClientBroker = require("../models/ClientBroker");
    let clientBroker;

    if (domain) {
      clientBroker = await ClientBroker.findOne({
        domain: domain,
        isActive: true,
      });
    }

    if (!clientBroker) {
      console.log(
        `[DEBUG] Creating new client broker. Domain provided: ${domain}`
      );

      const brokerData = {
        name: domain || `Auto-Broker ${new Date().toISOString()}`,
        isActive: true,
        description: domain
          ? `Auto-created from injection redirect to ${domain}`
          : `Auto-created for a lead with no domain`,
        createdBy: assignedBy,
      };

      if (domain) {
        brokerData.domain = domain;
      }

      clientBroker = new ClientBroker(brokerData);

      await clientBroker.save();
      console.log(
        `[DEBUG] Created new client broker with ID: ${clientBroker._id} and domain: ${clientBroker.domain}`
      );
    } else {
      console.log(
        `[DEBUG] Found existing client broker for domain: ${domain} (ID: ${clientBroker._id})`
      );
    }
    if (lead.isAssignedToClientBroker(clientBroker._id)) {
      console.log(
        `[DEBUG] Lead ${lead._id} is already assigned to broker ${clientBroker._id}`
      );
      return clientBroker;
    }
    lead.assignClientBroker(
      clientBroker._id,
      assignedBy,
      orderId,
      null,
      domain
    );
    const recentAssignment = lead.clientBrokerHistory
      .filter(
        (history) =>
          history.orderId && history.orderId.toString() === orderId.toString()
      )
      .pop();
    if (recentAssignment) {
      recentAssignment.injectionStatus = "successful";
      recentAssignment.domain = domain;
    }
    clientBroker.assignLead(lead._id);
    await Promise.all([lead.save(), clientBroker.save()]);
    console.log(
      `[DEBUG] Successfully assigned client broker ${clientBroker.name} (${domain}) to lead ${lead._id}`
    );
    return clientBroker;
  } catch (error) {
    console.error(
      `[ERROR] Failed to assign client broker by domain ${domain}:`,
      error
    );
    throw error;
  }
};
const updateOrderInjectionProgress = async (
  orderId,
  failedCount = 0,
  successCount = 0
) => {
  try {
    const update = {};
    if (failedCount > 0) {
      update["$inc"] = { "injectionProgress.failedInjections": failedCount };
    }
    if (successCount > 0) {
      update["$inc"] = {
        ...update["$inc"],
        "injectionProgress.successfulInjections": successCount,
      };
    }
    await Order.findByIdAndUpdate(orderId, update);
    const order = await Order.findById(orderId);
    const totalProcessed =
      order.injectionProgress.successfulInjections +
      order.injectionProgress.failedInjections;
    if (totalProcessed >= order.injectionProgress.totalToInject) {
      await Order.findByIdAndUpdate(orderId, {
        "injectionSettings.status": "completed",
        "injectionProgress.completedAt": new Date(),
      });
      console.log(`Injection completed for order ${orderId}`);
      const brokersAssigned = order.injectionProgress.brokersAssigned || 0;
      const successfulInjections =
        order.injectionProgress.successfulInjections || 0;
      if (
        brokersAssigned >= successfulInjections &&
        !order.injectionProgress.brokerAssignmentPending
      ) {
        await Order.findByIdAndUpdate(orderId, {
          "clientBrokerAssignment.status": "completed",
          "clientBrokerAssignment.assignedAt": new Date(),
          "clientBrokerAssignment.notes":
            "Auto-assigned based on injection redirect domains",
        });
        console.log(
          `Client broker assignment completed automatically for order ${orderId}`
        );
      }
    }
  } catch (error) {
    console.error(
      `Error updating injection progress for order ${orderId}:`,
      error
    );
  }
};
const scheduleRandomInjections = (leads, order) => {
  let startTimeMs, endTimeMs;
  if (
    order.injectionSettings.scheduledTime.startTime.includes(":") &&
    order.injectionSettings.scheduledTime.startTime.length <= 5
  ) {
    const [startHour, startMinute] =
      order.injectionSettings.scheduledTime.startTime.split(":").map(Number);
    const [endHour, endMinute] = order.injectionSettings.scheduledTime.endTime
      .split(":")
      .map(Number);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTime = new Date(
      today.getTime() + (startHour * 60 + startMinute) * 60 * 1000
    );
    const endTime = new Date(
      today.getTime() + (endHour * 60 + endMinute) * 60 * 1000
    );
    if (startTime <= now) {
      startTime.setDate(startTime.getDate() + 1);
      endTime.setDate(endTime.getDate() + 1);
    }
    startTimeMs = Math.max(0, startTime.getTime() - now.getTime());
    endTimeMs = Math.max(0, endTime.getTime() - now.getTime());
    console.log(`🕐 Current time: ${now.toLocaleTimeString()}`);
    console.log(
      `🎯 Start time: ${startTime.toLocaleTimeString()} (in ${Math.round(
        startTimeMs / 1000 / 60
      )} minutes)`
    );
    console.log(
      `🏁 End time: ${endTime.toLocaleTimeString()} (in ${Math.round(
        endTimeMs / 1000 / 60
      )} minutes)`
    );
  } else {
    const startTime = new Date(order.injectionSettings.scheduledTime.startTime);
    const endTime = new Date(order.injectionSettings.scheduledTime.endTime);
    const now = new Date();
    startTimeMs = Math.max(0, startTime.getTime() - now.getTime());
    endTimeMs = Math.max(0, endTime.getTime() - now.getTime());
  }
  const windowMs = endTimeMs - startTimeMs;
  if (windowMs <= 0) {
    console.error("Invalid time window for scheduled injection");
    return;
  }
  console.log(
    `📅 Scheduling ${leads.length} leads for random injection over ${Math.round(
      windowMs / 1000 / 60
    )} minutes window`
  );
  const minIntervalMs =
    order.injectionSettings.scheduledTime.minInterval || 30000;
  const maxIntervalMs =
    order.injectionSettings.scheduledTime.maxInterval || 300000;
  const effectiveMinInterval = Math.min(
    minIntervalMs,
    windowMs / leads.length / 2
  );
  const effectiveMaxInterval = Math.min(
    maxIntervalMs,
    (windowMs / leads.length) * 2
  );
  console.log(
    `⏱️  Using interval range: ${Math.round(
      effectiveMinInterval / 1000
    )}s - ${Math.round(effectiveMaxInterval / 1000)}s between injections`
  );
  let currentDelay = startTimeMs;
  leads.forEach((lead, index) => {
    const randomInterval =
      effectiveMinInterval +
      Math.random() * (effectiveMaxInterval - effectiveMinInterval);
    currentDelay += randomInterval;
    if (currentDelay > endTimeMs) {
      const remainingLeads = leads.length - index;
      const remainingTime = endTimeMs - (currentDelay - randomInterval);
      const evenInterval = remainingTime / remainingLeads;
      currentDelay = currentDelay - randomInterval + evenInterval;
    }
    console.log(
      `⏰ Lead ${index + 1}/${
        leads.length
      } scheduled for injection in ${Math.round(
        currentDelay / 1000 / 60
      )} minutes (${lead.firstName} ${lead.lastName})`
    );
    setTimeout(async () => {
      try {
        console.log(
          `⏰ TIMEOUT TRIGGERED for lead ${index + 1}/${leads.length}: ${
            lead.firstName
          } ${lead.lastName}`
        );
        const currentOrder = await Order.findById(order._id);
        console.log(
          `📊 Order status check: ${
            currentOrder
              ? currentOrder.injectionSettings.status
              : "ORDER NOT FOUND"
          }`
        );
        if (
          currentOrder &&
          currentOrder.injectionSettings.status === "in_progress"
        ) {
          console.log(
            `🚀 Starting scheduled injection for lead ${index + 1}/${
              leads.length
            }: ${lead.firstName} ${lead.lastName}`
          );
          const injectionResult = await injectSingleLead(lead, order._id);
          console.log(
            `✅ Injection completed for ${lead.firstName} ${lead.lastName}:`,
            injectionResult
          );
        } else {
          console.log(
            `⏸️  Skipping injection for lead ${lead.firstName} ${
              lead.lastName
            } - injection status: ${
              currentOrder?.injectionSettings?.status || "UNKNOWN"
            }`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error in scheduled injection for lead ${lead.firstName} ${lead.lastName}:`,
          error
        );
        console.error("Error stack:", error.stack);
      }
    }, currentDelay);
  });
  console.log(
    `✅ Successfully scheduled ${leads.length} leads for random injection over the specified time window`
  );
};
exports.startManualFTDInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can perform manual FTD injection.",
      });
    }
    const Lead = require("../models/Lead");
    const ftdLeads = await Lead.find({
      _id: { $in: order.leads },
      leadType: "ftd",
    });
    if (ftdLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No FTD leads found for this order",
      });
    }
    const leadToInject = ftdLeads[0];
    let proxyConfig = null;
    try {
      const { generateProxyConfig } = require("../utils/proxyManager");
      const proxyResult = await generateProxyConfig(leadToInject.country);
      proxyConfig = proxyResult.config;
      console.log(
        `[DEBUG] Generated proxy for manual injection: ${leadToInject.country}`
      );
    } catch (error) {
      console.error(
        `[ERROR] Failed to generate proxy for manual injection:`,
        error
      );
      return res.status(500).json({
        success: false,
        message: "Failed to generate proxy configuration for manual injection",
      });
    }
    const injectionData = {
      leadId: leadToInject._id.toString(),
      firstName: leadToInject.firstName,
      lastName: leadToInject.lastName,
      email: leadToInject.email,
      phone: leadToInject.newPhone || leadToInject.phone,
      country: leadToInject.country,
      country_code: leadToInject.prefix?.replace("+", "") || "1",
      targetUrl:
        process.env.LANDING_PAGE_URL ||
        "https://ftd-copy-g4r6.vercel.app/landing",
      proxy: proxyConfig,
    };
    const { spawn } = require("child_process");
    const path = require("path");
    const scriptPath = path.join(
      __dirname,
      "../../manual_injector_playwright.py"
    );
    const pythonProcess = spawn(
      "python",
      [scriptPath, JSON.stringify(injectionData)],
      {
        stdio: "pipe",
        cwd: path.dirname(scriptPath),
      }
    );
    let scriptOutput = "";
    let scriptError = "";
    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      scriptOutput += output;
      console.log(`Manual Injector Output: ${output}`);
    });
    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      scriptError += error;
      console.error(`Manual Injector Error: ${error}`);
    });
    pythonProcess.on("close", (code) => {
      console.log(`Manual injector script exited with code ${code}`);
      if (code !== 0) {
        console.error(`Manual injection failed with code ${code}`);
        console.error(`Script error: ${scriptError}`);
      } else {
        // If the script succeeded, try to read and store the session data
        console.log(
          `[DEBUG] Manual injection script completed successfully, checking for session data...`
        );

        // Try to read the session data file created by the Python script
        const fs = require("fs");
        const sessionDataFile = path.join(
          __dirname,
          "..",
          "..",
          `session_data_${leadToInject._id}.json`
        );

        try {
          if (fs.existsSync(sessionDataFile)) {
            console.log(`[DEBUG] Found session data file: ${sessionDataFile}`);

            const sessionFileContent = fs.readFileSync(sessionDataFile, "utf8");
            const sessionInfo = JSON.parse(sessionFileContent);

            if (sessionInfo.success && sessionInfo.sessionData) {
              console.log(
                `[DEBUG] Storing session data for lead ${leadToInject._id}...`
              );

              // Store the session data in the database using the authenticated user's context
              const { storeLeadSession } = require("../controllers/leads");

              // Create a mock request object for the session storage
              const mockReq = {
                user: req.user,
                params: { id: leadToInject._id },
                body: {
                  sessionData: sessionInfo.sessionData,
                  orderId: order._id,
                  assignedBy: req.user.id,
                },
              };

              const mockRes = {
                status: (code) => ({
                  json: (data) => {
                    if (code === 200 || code === 201) {
                      console.log(
                        `✅ Session data stored successfully for lead ${leadToInject._id}`
                      );
                      console.log(
                        `🔑 Session ID: ${sessionInfo.sessionData.sessionId}`
                      );
                    } else {
                      console.error(
                        `❌ Failed to store session data for lead ${leadToInject._id}:`,
                        data
                      );
                    }
                  },
                }),
              };

              const mockNext = (error) => {
                if (error) {
                  console.error(
                    `❌ Error storing session data for lead ${leadToInject._id}:`,
                    error
                  );
                }
              };

              // Call the session storage function
              storeLeadSession(mockReq, mockRes, mockNext);
            } else {
              console.error(
                `[DEBUG] Session data file exists but indicates failure for lead ${leadToInject._id}`
              );
            }

            // Clean up the session data file
            fs.unlinkSync(sessionDataFile);
            console.log(
              `[DEBUG] Cleaned up session data file: ${sessionDataFile}`
            );
          } else {
            console.log(
              `[DEBUG] No session data file found for lead ${leadToInject._id}, manual injection may not have created a session`
            );
          }
        } catch (error) {
          console.error(
            `[ERROR] Failed to read or process session data file for lead ${leadToInject._id}:`,
            error
          );

          // Try to clean up the file if it exists
          try {
            if (fs.existsSync(sessionDataFile)) {
              fs.unlinkSync(sessionDataFile);
            }
          } catch (cleanupError) {
            console.error(
              `[ERROR] Failed to cleanup session data file: ${cleanupError}`
            );
          }
        }
      }
    });
    res.status(200).json({
      success: true,
      message: "Manual FTD injection started. Browser should open shortly.",
      data: {
        leadId: leadToInject._id,
        leadInfo: {
          firstName: leadToInject.firstName,
          lastName: leadToInject.lastName,
          email: leadToInject.email,
          phone: leadToInject.newPhone || leadToInject.phone,
          country: leadToInject.country,
        },
      },
    });
  } catch (error) {
    console.error("Error starting manual FTD injection:", error);
    next(error);
  }
};
exports.completeManualFTDInjection = async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: "Domain is required",
      });
    }
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can complete manual FTD injection.",
      });
    }
    const Lead = require("../models/Lead");
    const ftdLeads = await Lead.find({
      _id: { $in: order.leads },
      leadType: "ftd",
    });
    if (ftdLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No FTD leads found for this order",
      });
    }
    const leadToProcess = ftdLeads.find((lead) => {
      const networkHistory = lead.clientNetworkHistory?.find(
        (history) => history.orderId?.toString() === order._id.toString()
      );
      return !networkHistory || networkHistory.injectionStatus !== "completed";
    });
    if (!leadToProcess) {
      return res.status(400).json({
        success: false,
        message: "All FTD leads for this order have already been processed",
      });
    }
    let cleanDomain = domain.trim();
    if (
      cleanDomain.startsWith("http://") ||
      cleanDomain.startsWith("https://")
    ) {
      try {
        const url = new URL(cleanDomain);
        cleanDomain = url.hostname;
      } catch (e) {
        cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
      }
    }
    cleanDomain = cleanDomain.split("/")[0].split("?")[0].split("#")[0];
    if (!cleanDomain) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain format",
      });
    }
    try {
      console.log(
        `[DEBUG] Attempting to assign client broker for domain: ${cleanDomain}`
      );
      console.log(`[DEBUG] Lead to process: ${leadToProcess._id}`);
      console.log(`[DEBUG] User ID: ${req.user.id}`);
      console.log(`[DEBUG] Order ID: ${order._id}`);
      const assignedBroker = await assignClientBrokerByDomain(
        leadToProcess,
        cleanDomain,
        req.user.id,
        order._id
      );
      if (!assignedBroker) {
        throw new Error(
          "assignClientBrokerByDomain returned null or undefined"
        );
      }
      console.log(
        `[DEBUG] Successfully assigned broker: ${assignedBroker._id} (${assignedBroker.name})`
      );
      const networkHistoryEntry = {
        clientNetwork: order.selectedClientNetwork,
        clientBroker: assignedBroker._id,
        orderId: order._id,
        assignedAt: new Date(),
        assignedBy: req.user.id,
        domain: cleanDomain,
        injectionStatus: "completed",
        injectionType: "manual_ftd",
        injectionNotes:
          "Manual FTD injection completed by affiliate manager/admin",
      };
      const existingHistoryIndex =
        leadToProcess.clientNetworkHistory?.findIndex(
          (history) => history.orderId?.toString() === order._id.toString()
        );
      if (existingHistoryIndex >= 0) {
        leadToProcess.clientNetworkHistory[existingHistoryIndex] =
          networkHistoryEntry;
      } else {
        if (!leadToProcess.clientNetworkHistory) {
          leadToProcess.clientNetworkHistory = [];
        }
        leadToProcess.clientNetworkHistory.push(networkHistoryEntry);
      }
      leadToProcess.isAssigned = true;
      leadToProcess.lastAssignedAt = new Date();
      await leadToProcess.save();

      // Trigger QuantumAI injection after successful manual FTD injection completion
      console.log(
        "🎯 Triggering QuantumAI injection for manually injected FTD lead..."
      );
      try {
        // Generate proxy configuration for QuantumAI injection
        const { generateProxyConfig } = require("../utils/proxyManager");
        const proxyResult = await generateProxyConfig(leadToProcess.country);
        const quantumAIProxyConfig = proxyResult.config;

        console.log(
          `[DEBUG] Generated proxy for QuantumAI injection: ${leadToProcess.country}`
        );

        // Trigger QuantumAI injection
        runQuantumAIInjector(leadToProcess, quantumAIProxyConfig)
          .then((result) => {
            if (result.success) {
              console.log(
                "✅ QuantumAI injection completed successfully for manually injected FTD lead:",
                leadToProcess._id
              );
            } else {
              console.error(
                "❌ QuantumAI injection failed for manually injected FTD lead:",
                leadToProcess._id,
                result.error
              );
            }
          })
          .catch((error) => {
            console.error(
              "💥 QuantumAI injection error for manually injected FTD lead:",
              leadToProcess._id,
              error
            );
          });
      } catch (error) {
        console.error(
          `[ERROR] Failed to generate proxy for QuantumAI injection:`,
          error
        );
        // Don't fail the main request if QuantumAI fails, just log the error
      }

      const allFTDLeads = await Lead.find({
        _id: { $in: order.leads },
        leadType: "ftd",
      });
      const allFTDsInjected = allFTDLeads.every((lead) => {
        const networkHistory = lead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return networkHistory && networkHistory.injectionStatus === "completed";
      });
      if (allFTDsInjected) {
        order.ftdHandling.status = "completed";
        order.ftdHandling.completedAt = new Date();
        order.ftdHandling.notes =
          "All FTD leads manually injected and assigned to client brokers";
      }
      order.injectionProgress.ftdsPendingManualFill = Math.max(
        0,
        order.injectionProgress.ftdsPendingManualFill - 1
      );
      await order.save();
      res.status(200).json({
        success: true,
        message: "Manual FTD injection completed successfully",
        data: {
          leadId: leadToProcess._id,
          domain: cleanDomain,
          clientBroker: {
            id: assignedBroker._id,
            name: assignedBroker.name,
            domain: assignedBroker.domain,
          },
          allFTDsCompleted: allFTDsInjected,
        },
      });
    } catch (error) {
      console.error("Error assigning client broker:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to assign client broker based on domain",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Error completing manual FTD injection:", error);
    next(error);
  }
};
exports.startManualFTDInjectionForLead = async (req, res, next) => {
  try {
    const { id: orderId, leadId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can perform manual FTD injection.",
      });
    }
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: "ftd",
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "FTD lead not found in this order",
      });
    }
    const existingHistory = lead.clientNetworkHistory?.find(
      (history) => history.orderId?.toString() === orderId.toString()
    );
    if (existingHistory && existingHistory.injectionStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "This FTD lead has already been processed",
      });
    }
    if (!lead.fingerprint) {
      try {
        console.log(
          `[DEBUG] Assigning device fingerprint to FTD lead ${lead._id}`
        );
        const deviceConfig = order.injectionSettings?.deviceConfig || {};
        let deviceType = "android";
        if (
          deviceConfig.selectionMode === "bulk" &&
          deviceConfig.bulkDeviceType
        ) {
          deviceType = deviceConfig.bulkDeviceType;
        } else if (
          deviceConfig.selectionMode === "individual" &&
          deviceConfig.individualAssignments
        ) {
          const assignment = deviceConfig.individualAssignments.find(
            (assign) => assign.leadId.toString() === lead._id.toString()
          );
          if (assignment) {
            deviceType = assignment.deviceType;
          }
        } else if (
          deviceConfig.selectionMode === "ratio" &&
          deviceConfig.deviceRatio
        ) {
          const availableTypes = Object.keys(deviceConfig.deviceRatio).filter(
            (type) => deviceConfig.deviceRatio[type] > 0
          );
          if (availableTypes.length > 0) {
            deviceType =
              availableTypes[Math.floor(Math.random() * availableTypes.length)];
          }
        } else {
          const availableTypes = deviceConfig.availableDeviceTypes || [
            "windows",
            "android",
            "ios",
            "mac",
          ];
          deviceType =
            availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }
        const validDeviceTypes = ["windows", "android", "ios", "mac"];
        if (!deviceType || !validDeviceTypes.includes(deviceType)) {
          console.log(
            `[WARN] Invalid deviceType '${deviceType}', using default 'android'`
          );
          deviceType = "android";
        }
        console.log(
          `[DEBUG] Using deviceType: ${deviceType} for FTD lead ${lead._id}`
        );
        await lead.assignFingerprint(deviceType, order.requester);
        await lead.save();
        console.log(
          `[DEBUG] Assigned ${deviceType} device to FTD lead ${lead._id}`
        );
      } catch (error) {
        console.error(
          `[ERROR] Failed to assign device fingerprint to FTD lead ${lead._id}:`,
          error
        );
      }
    }
    let fingerprintConfig = null;
    if (lead.fingerprint) {
      try {
        const fingerprint = await lead.getFingerprint();
        if (fingerprint) {
          fingerprintConfig = {
            deviceId: fingerprint.deviceId,
            deviceType: fingerprint.deviceType,
            browser: fingerprint.browser,
            screen: fingerprint.screen,
            navigator: fingerprint.navigator,
            webgl: fingerprint.webgl,
            canvasFingerprint: fingerprint.canvasFingerprint,
            audioFingerprint: fingerprint.audioFingerprint,
            timezone: fingerprint.timezone,
            plugins: fingerprint.plugins,
            mobile: fingerprint.mobile,
            additional: fingerprint.additional,
          };
          console.log(
            `[DEBUG] Using fingerprint ${fingerprint.deviceId} for FTD lead ${lead._id}`
          );
        }
      } catch (error) {
        console.error(
          `[ERROR] Failed to get fingerprint for FTD lead ${lead._id}:`,
          error
        );
      }
    }
    let proxyConfig = null;
    try {
      const { generateProxyConfig } = require("../utils/proxyManager");
      const proxyResult = await generateProxyConfig(lead.country);
      proxyConfig = proxyResult.config;
      console.log(
        `[DEBUG] Generated proxy for manual injection: ${lead.country}`
      );
    } catch (error) {
      console.error(
        `[ERROR] Failed to generate proxy for manual injection:`,
        error
      );
      return res.status(500).json({
        success: false,
        message: "Failed to generate proxy configuration for manual injection",
      });
    }
    const injectionData = {
      leadId: lead._id.toString(),
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone || lead.phone,
      country: lead.country,
      country_code: lead.prefix?.replace("+", "") || "1",
      targetUrl:
        process.env.LANDING_PAGE_URL ||
        "https://ftd-copy-g4r6.vercel.app/landing",
      fingerprint: fingerprintConfig,
      proxy: proxyConfig,
    };
    const { spawn } = require("child_process");
    const path = require("path");
    const scriptPath = path.join(
      __dirname,
      "../../manual_injector_playwright.py"
    );
    const pythonProcess = spawn(
      "python",
      [scriptPath, JSON.stringify(injectionData)],
      {
        stdio: "pipe",
        cwd: path.dirname(scriptPath),
      }
    );
    let scriptOutput = "";
    let scriptError = "";
    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      scriptOutput += output;
      console.log(`Manual Injector Output: ${output}`);
    });
    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      scriptError += error;
      console.error(`Manual Injector Error: ${error}`);
    });
    pythonProcess.on("close", (code) => {
      console.log(`Manual injector script exited with code ${code}`);
      if (code !== 0) {
        console.error(`Manual injection failed with code ${code}`);
        console.error(`Script error: ${scriptError}`);
      }
    });
    res.status(200).json({
      success: true,
      message: "Manual FTD injection started. Browser should open shortly.",
      data: {
        leadId: lead._id,
        leadInfo: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.newEmail,
          phone: lead.newPhone || lead.phone,
          country: lead.country,
        },
        deviceInfo: {
          deviceType: lead.deviceType,
          fingerprintId: lead.fingerprint,
        },
      },
    });
  } catch (error) {
    console.error("Error starting manual FTD injection for lead:", error);
    next(error);
  }
};
exports.completeManualFTDInjectionForLead = async (req, res, next) => {
  try {
    const { id: orderId, leadId } = req.params;
    const { domain } = req.body;
    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: "Domain is required and cannot be empty",
      });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can complete manual FTD injection.",
      });
    }
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: "ftd",
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "FTD lead not found in this order",
      });
    }
    const existingHistory = lead.clientNetworkHistory?.find(
      (history) => history.orderId?.toString() === orderId.toString()
    );
    if (existingHistory && existingHistory.injectionStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "This FTD lead has already been processed",
      });
    }
    let cleanDomain = domain.trim();
    if (
      cleanDomain.startsWith("http://") ||
      cleanDomain.startsWith("https://")
    ) {
      try {
        const url = new URL(cleanDomain);
        cleanDomain = url.hostname;
      } catch (e) {
        cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
      }
    }
    cleanDomain = cleanDomain.split("/")[0].split("?")[0].split("#")[0];
    if (!cleanDomain) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain format",
      });
    }
    try {
      console.log(
        `[DEBUG] Attempting to assign client broker for lead ${leadId} with domain: ${cleanDomain}`
      );
      const assignedBroker = await assignClientBrokerByDomain(
        lead,
        cleanDomain,
        req.user.id,
        order._id
      );
      if (!assignedBroker) {
        throw new Error("Failed to assign client broker for domain");
      }
      console.log(
        `[DEBUG] Successfully assigned broker: ${assignedBroker._id} (${assignedBroker.name})`
      );
      const networkHistoryEntry = {
        clientNetwork: order.selectedClientNetwork,
        clientBroker: assignedBroker._id,
        orderId: order._id,
        assignedAt: new Date(),
        assignedBy: req.user.id,
        domain: cleanDomain,
        injectionStatus: "completed",
        injectionType: "manual_ftd",
        injectionNotes: `Manual FTD injection completed by ${
          req.user.fullName || req.user.email
        }`,
      };
      const existingHistoryIndex = lead.clientNetworkHistory?.findIndex(
        (history) => history.orderId?.toString() === order._id.toString()
      );
      if (existingHistoryIndex >= 0) {
        lead.clientNetworkHistory[existingHistoryIndex] = networkHistoryEntry;
      } else {
        if (!lead.clientNetworkHistory) {
          lead.clientNetworkHistory = [];
        }
        lead.clientNetworkHistory.push(networkHistoryEntry);
      }
      lead.isAssigned = true;
      lead.lastAssignedAt = new Date();
      await lead.save();

      // Trigger QuantumAI injection after successful manual FTD injection completion
      console.log(
        "🎯 Triggering QuantumAI injection for manually injected FTD lead..."
      );
      try {
        // Generate proxy configuration for QuantumAI injection
        const { generateProxyConfig } = require("../utils/proxyManager");
        const proxyResult = await generateProxyConfig(lead.country);
        const quantumAIProxyConfig = proxyResult.config;

        console.log(
          `[DEBUG] Generated proxy for QuantumAI injection: ${lead.country}`
        );

        // Trigger QuantumAI injection
        runQuantumAIInjector(lead, quantumAIProxyConfig)
          .then((result) => {
            if (result.success) {
              console.log(
                "✅ QuantumAI injection completed successfully for manually injected FTD lead:",
                lead._id
              );
            } else {
              console.error(
                "❌ QuantumAI injection failed for manually injected FTD lead:",
                lead._id,
                result.error
              );
            }
          })
          .catch((error) => {
            console.error(
              "💥 QuantumAI injection error for manually injected FTD lead:",
              lead._id,
              error
            );
          });
      } catch (error) {
        console.error(
          `[ERROR] Failed to generate proxy for QuantumAI injection:`,
          error
        );
        // Don't fail the main request if QuantumAI fails, just log the error
      }

      const Lead = require("../models/Lead");
      const allFTDLeads = await Lead.find({
        _id: { $in: order.leads },
        leadType: "ftd",
      });
      const allFTDsInjected = allFTDLeads.every((ftdLead) => {
        const networkHistory = ftdLead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return networkHistory && networkHistory.injectionStatus === "completed";
      });
      if (allFTDsInjected) {
        order.ftdHandling.status = "completed";
        order.ftdHandling.completedAt = new Date();
        order.ftdHandling.notes =
          "All FTD leads manually injected and assigned to client brokers";
      }
      order.injectionProgress.ftdsPendingManualFill = Math.max(
        0,
        order.injectionProgress.ftdsPendingManualFill - 1
      );
      await order.save();
      res.status(200).json({
        success: true,
        message: "Manual FTD injection completed successfully for this lead",
        data: {
          leadId: lead._id,
          domain: cleanDomain,
          clientBroker: {
            id: assignedBroker._id,
            name: assignedBroker.name,
            domain: assignedBroker.domain,
          },
          allFTDsCompleted: allFTDsInjected,
        },
      });
    } catch (error) {
      console.error(`Error assigning client broker for lead ${leadId}:`, error);
      return res.status(500).json({
        success: false,
        message: "Failed to assign client broker based on domain",
        error: error.message,
      });
    }
  } catch (error) {
    console.error(
      `Error completing manual FTD injection for lead ${leadId}:`,
      error
    );
    next(error);
  }
};
exports.startManualInjectionForLead = async (req, res, next) => {
  try {
    const { id: orderId, leadId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can perform manual injection.",
      });
    }
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: { $in: ["ftd", "filler"] },
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message:
          "Lead not found in this order or lead type not supported for manual injection",
      });
    }
    const existingHistory = lead.clientNetworkHistory?.find(
      (history) => history.orderId?.toString() === orderId.toString()
    );
    if (existingHistory && existingHistory.injectionStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: `This ${lead.leadType.toUpperCase()} lead has already been processed`,
      });
    }
    if (!lead.fingerprint) {
      try {
        console.log(
          `[DEBUG] Assigning device fingerprint to ${lead.leadType.toUpperCase()} lead ${
            lead._id
          }`
        );
        const deviceConfig = order.injectionSettings?.deviceConfig || {};
        let deviceType = "android";
        if (
          deviceConfig.selectionMode === "bulk" &&
          deviceConfig.bulkDeviceType
        ) {
          deviceType = deviceConfig.bulkDeviceType;
        } else if (
          deviceConfig.selectionMode === "individual" &&
          deviceConfig.individualAssignments
        ) {
          const assignment = deviceConfig.individualAssignments.find(
            (assign) => assign.leadId.toString() === lead._id.toString()
          );
          if (assignment) {
            deviceType = assignment.deviceType;
          }
        } else if (
          deviceConfig.selectionMode === "ratio" &&
          deviceConfig.deviceRatio
        ) {
          const availableTypes = Object.keys(deviceConfig.deviceRatio).filter(
            (type) => deviceConfig.deviceRatio[type] > 0
          );
          if (availableTypes.length > 0) {
            deviceType =
              availableTypes[Math.floor(Math.random() * availableTypes.length)];
          }
        } else {
          const availableTypes = deviceConfig.availableDeviceTypes || [
            "windows",
            "android",
            "ios",
            "mac",
          ];
          deviceType =
            availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }
        const validDeviceTypes = ["windows", "android", "ios", "mac"];
        if (!deviceType || !validDeviceTypes.includes(deviceType)) {
          console.log(
            `[WARN] Invalid deviceType '${deviceType}', using default 'android'`
          );
          deviceType = "android";
        }
        console.log(
          `[DEBUG] Using deviceType: ${deviceType} for ${lead.leadType.toUpperCase()} lead ${
            lead._id
          }`
        );
        await lead.assignFingerprint(deviceType, order.requester);
        await lead.save();
        console.log(
          `[DEBUG] Assigned ${deviceType} device to ${lead.leadType.toUpperCase()} lead ${
            lead._id
          }`
        );
      } catch (error) {
        console.error(
          `[ERROR] Failed to assign device fingerprint to ${lead.leadType.toUpperCase()} lead ${
            lead._id
          }:`,
          error
        );
      }
    }
    let fingerprintConfig = null;
    if (lead.fingerprint) {
      try {
        const fingerprint = await lead.getFingerprint();
        if (fingerprint) {
          fingerprintConfig = {
            deviceId: fingerprint.deviceId,
            deviceType: fingerprint.deviceType,
            browser: fingerprint.browser,
            screen: fingerprint.screen,
            navigator: fingerprint.navigator,
            webgl: fingerprint.webgl,
            canvasFingerprint: fingerprint.canvasFingerprint,
            audioFingerprint: fingerprint.audioFingerprint,
            timezone: fingerprint.timezone,
            plugins: fingerprint.plugins,
            mobile: fingerprint.mobile,
            additional: fingerprint.additional,
          };
          console.log(
            `[DEBUG] Using fingerprint ${
              fingerprint.deviceId
            } for ${lead.leadType.toUpperCase()} lead ${lead._id}`
          );
        }
      } catch (error) {
        console.error(
          `[ERROR] Failed to get fingerprint for ${lead.leadType.toUpperCase()} lead ${
            lead._id
          }:`,
          error
        );
      }
    }
    let proxyConfig = null;
    try {
      const { generateProxyConfig } = require("../utils/proxyManager");
      const proxyResult = await generateProxyConfig(lead.country);
      proxyConfig = proxyResult.config;
      console.log(
        `[DEBUG] Generated proxy for manual injection: ${lead.country}`
      );
    } catch (error) {
      console.error(
        `[ERROR] Failed to generate proxy for manual injection:`,
        error
      );
      return res.status(500).json({
        success: false,
        message: "Failed to generate proxy configuration for manual injection",
      });
    }
    const injectionData = {
      leadId: lead._id.toString(),
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone || lead.phone,
      country: lead.country,
      country_code: lead.prefix?.replace("+", "") || "1",
      leadType: lead.leadType,
      targetUrl:
        process.env.LANDING_PAGE_URL ||
        "https://ftd-copy-g4r6.vercel.app/landing",
      fingerprint: fingerprintConfig,
      proxy: proxyConfig,
    };

    // Check if Session API is available
    const axios = require("axios");
    const sessionApiUrl =
      process.env.EC2_GUI_BROWSER_URL || "http://localhost:3001";
    let useSessionApi = false;

    console.log(
      `[DEBUG] Checking Session API availability at: ${sessionApiUrl}`
    );

    try {
      const healthCheck = await axios.get(`${sessionApiUrl}/`, {
        timeout: 5000,
      });
      console.log(`[DEBUG] Session API health check: ${healthCheck.status}`);
      useSessionApi = true;
    } catch (healthError) {
      console.error(
        `[ERROR] Session API health check failed:`,
        healthError.message
      );
      console.log(`[DEBUG] Falling back to direct playwright approach`);
      useSessionApi = false;
    }

    if (useSessionApi) {
      // Use Session API approach
      try {
        // Generate session ID
        const sessionId = `manual_${lead._id}_${Date.now()}`;

        // Prepare session data for GUI browser
        const sessionData = {
          sessionId: sessionId,
          leadId: lead._id.toString(),
          cookies: [],
          localStorage: {},
          sessionStorage: {},
          userAgent:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          viewport: { width: 1920, height: 1080 },
          domain: injectionData.targetUrl,
          proxy: proxyConfig,
          leadInfo: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.newEmail,
            phone: lead.newPhone || lead.phone,
            country: lead.country,
            leadType: lead.leadType,
            targetUrl: injectionData.targetUrl,
          },
        };

        console.log(`[DEBUG] Creating GUI browser session: ${sessionId}`);

        const response = await axios.post(
          `${sessionApiUrl}/sessions`,
          sessionData,
          {
            timeout: 60000, // Increased timeout for session creation
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          console.log(
            `✅ GUI browser session created successfully: ${sessionId}`
          );
          console.log(`✅ GUI browser session created successfully`);

          // Store session info using the existing Lead method
          const sessionDataToStore = {
            sessionId: sessionId,
            cookies: [],
            localStorage: {},
            sessionStorage: {},
            userAgent: sessionData.userAgent,
            viewport: sessionData.viewport,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
            isActive: true,
            metadata: {
              domain: sessionData.domain,
              success: false, // Will be updated when manual injection is completed
              injectionType: `manual_${lead.leadType}`,
              notes: `Manual ${lead.leadType.toUpperCase()} injection session created`,
              orderId: orderId,
              assignedBy: req.user._id,
            },
          };

          lead.storeBrowserSession(sessionDataToStore, orderId, req.user._id);
          await lead.save();

          console.log(
            `✅ Manual injection session created and stored for lead ${lead._id}`
          );

          // Return success response for GUI browser session
          return res.status(200).json({
            success: true,
            message: `Manual ${lead.leadType.toUpperCase()} injection started. GUI browser session created successfully.`,
            data: {
              leadId: lead._id,
              leadType: lead.leadType,
              leadInfo: {
                firstName: lead.firstName,
                lastName: lead.lastName,
                email: lead.newEmail,
                phone: lead.newPhone || lead.phone,
                country: lead.country,
              },
              deviceInfo: {
                deviceType: lead.deviceType,
                fingerprintId: lead.fingerprint,
              },
              injectionMethod: "session_api",
              sessionId: sessionId,
            },
          });
        } else {
          throw new Error(
            response.data.message || "Failed to create GUI browser session"
          );
        }
      } catch (error) {
        console.error(`❌ Error creating GUI browser session:`, error);
        console.log(`⚠️ Falling back to local script for lead: ${lead._id}`);

        // Fall back to local script if EC2 GUI browser service fails
        useSessionApi = false;
      }
    } else {
      // Use direct playwright approach as fallback
      console.log(
        `[DEBUG] Using direct playwright approach for manual injection`
      );

      const { spawn } = require("child_process");
      const path = require("path");
      const scriptPath = path.join(
        __dirname,
        "../../manual_injector_playwright.py"
      );

      console.log(
        `[DEBUG] Starting manual injection for ${lead.leadType.toUpperCase()} lead: ${
          lead._id
        }`
      );
      console.log(`[DEBUG] Injection data keys: ${Object.keys(injectionData)}`);

      const pythonProcess = spawn(
        "python",
        [scriptPath, JSON.stringify(injectionData)],
        {
          stdio: "pipe",
          cwd: path.dirname(scriptPath),
        }
      );

      let scriptOutput = "";
      let scriptError = "";

      pythonProcess.stdout.on("data", (data) => {
        const output = data.toString();
        scriptOutput += output;
        console.log(`Manual Injector Output: ${output}`);
      });

      pythonProcess.stderr.on("data", (data) => {
        const error = data.toString();
        scriptError += error;
        console.error(`Manual Injector Error: ${error}`);
      });

      pythonProcess.on("close", (code) => {
        console.log(`Manual injector script exited with code ${code}`);
        if (code !== 0) {
          console.error(`Manual injection failed with code ${code}`);
          console.error(`Script error: ${scriptError}`);
        } else {
          // If the script succeeded, try to read and store the session data
          console.log(
            `[DEBUG] Manual injection script completed successfully, checking for session data...`
          );

          // Try to read the session data file created by the Python script
          const fs = require("fs");
          const sessionDataFile = path.join(
            __dirname,
            "..",
            "..",
            `session_data_${lead._id}.json`
          );

          try {
            if (fs.existsSync(sessionDataFile)) {
              console.log(
                `[DEBUG] Found session data file: ${sessionDataFile}`
              );

              const sessionFileContent = fs.readFileSync(
                sessionDataFile,
                "utf8"
              );
              const sessionInfo = JSON.parse(sessionFileContent);

              if (sessionInfo.success && sessionInfo.sessionData) {
                console.log(
                  `[DEBUG] Storing session data for lead ${lead._id}...`
                );

                // Store the session data in the database using the authenticated user's context
                const { storeLeadSession } = require("../controllers/leads");

                // Create a mock request object for the session storage
                const mockReq = {
                  user: req.user,
                  params: { id: lead._id },
                  body: {
                    sessionData: sessionInfo.sessionData,
                    orderId: order._id,
                    assignedBy: req.user.id,
                  },
                };

                const mockRes = {
                  status: (code) => ({
                    json: (data) => {
                      if (code === 200 || code === 201) {
                        console.log(
                          `✅ Session data stored successfully for lead ${lead._id}`
                        );
                        console.log(
                          `🔑 Session ID: ${sessionInfo.sessionData.sessionId}`
                        );
                      } else {
                        console.error(
                          `❌ Failed to store session data for lead ${lead._id}:`,
                          data
                        );
                      }
                    },
                  }),
                };

                const mockNext = (error) => {
                  if (error) {
                    console.error(
                      `❌ Error storing session data for lead ${lead._id}:`,
                      error
                    );
                  }
                };

                // Call the session storage function
                storeLeadSession(mockReq, mockRes, mockNext);
              } else {
                console.error(
                  `[DEBUG] Session data file exists but indicates failure for lead ${lead._id}`
                );
              }

              // Clean up the session data file
              fs.unlinkSync(sessionDataFile);
              console.log(
                `[DEBUG] Cleaned up session data file: ${sessionDataFile}`
              );
            } else {
              console.log(
                `[DEBUG] No session data file found for lead ${lead._id}, manual injection may not have created a session`
              );
            }
          } catch (error) {
            console.error(
              `[ERROR] Failed to read or process session data file for lead ${lead._id}:`,
              error
            );

            // Try to clean up the file if it exists
            try {
              if (fs.existsSync(sessionDataFile)) {
                fs.unlinkSync(sessionDataFile);
              }
            } catch (cleanupError) {
              console.error(
                `[ERROR] Failed to cleanup session data file: ${cleanupError}`
              );
            }
          }
        }
      });
    }

    res.status(200).json({
      success: true,
      message: `Manual ${lead.leadType.toUpperCase()} injection started. Browser should open shortly.`,
      data: {
        leadId: lead._id,
        leadType: lead.leadType,
        leadInfo: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.newEmail,
          phone: lead.newPhone || lead.phone,
          country: lead.country,
        },
        deviceInfo: {
          deviceType: lead.deviceType,
          fingerprintId: lead.fingerprint,
        },
        injectionMethod: useSessionApi ? "session_api" : "direct_playwright",
      },
    });
  } catch (error) {
    console.error(`Error starting manual injection for lead:`, error);
    next(error);
  }
};
exports.completeManualInjectionForLead = async (req, res, next) => {
  try {
    const { id: orderId, leadId } = req.params;
    const { domain } = req.body;
    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: "Domain is required and cannot be empty",
      });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can complete manual injection.",
      });
    }
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: { $in: ["ftd", "filler"] },
    });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message:
          "Lead not found in this order or lead type not supported for manual injection",
      });
    }
    const existingHistory = lead.clientNetworkHistory?.find(
      (history) => history.orderId?.toString() === orderId.toString()
    );
    if (existingHistory && existingHistory.injectionStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: `This ${lead.leadType.toUpperCase()} lead has already been processed`,
      });
    }
    let cleanDomain = domain.trim();
    if (
      cleanDomain.startsWith("http://") ||
      cleanDomain.startsWith("https://")
    ) {
      try {
        const url = new URL(cleanDomain);
        cleanDomain = url.hostname;
      } catch (e) {
        cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
      }
    }
    cleanDomain = cleanDomain.split("/")[0].split("?")[0].split("#")[0];
    if (!cleanDomain) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain format",
      });
    }
    try {
      console.log(
        `[DEBUG] Attempting to assign client broker for ${lead.leadType.toUpperCase()} lead ${leadId} with domain: ${cleanDomain}`
      );
      const assignedBroker = await assignClientBrokerByDomain(
        lead,
        cleanDomain,
        req.user.id,
        order._id
      );
      if (!assignedBroker) {
        throw new Error("Failed to assign client broker for domain");
      }
      console.log(
        `[DEBUG] Successfully assigned broker: ${assignedBroker._id} (${assignedBroker.name})`
      );
      let clientNetworkId = order.selectedClientNetwork || null;
      if (!clientNetworkId) {
        console.log(
          `[DEBUG] No client network available for manual injection - proceeding with direct broker assignment`
        );
      }
      const networkHistoryEntry = {
        clientNetwork: clientNetworkId,
        clientBroker: assignedBroker._id,
        orderId: order._id,
        assignedAt: new Date(),
        assignedBy: req.user.id,
        domain: cleanDomain,
        injectionStatus: "completed",
        injectionType: `manual_${lead.leadType}`,
        injectionNotes: `Manual ${lead.leadType.toUpperCase()} injection completed by ${
          req.user.fullName || req.user.email
        }`,
      };
      const existingHistoryIndex = lead.clientNetworkHistory?.findIndex(
        (history) => history.orderId?.toString() === order._id.toString()
      );
      if (existingHistoryIndex >= 0) {
        lead.clientNetworkHistory[existingHistoryIndex] = networkHistoryEntry;
      } else {
        if (!lead.clientNetworkHistory) {
          lead.clientNetworkHistory = [];
        }
        lead.clientNetworkHistory.push(networkHistoryEntry);
      }
      lead.isAssigned = true;
      lead.lastAssignedAt = new Date();
      await lead.save();

      // Trigger QuantumAI injection after successful manual injection completion
      console.log(
        "🎯 Triggering QuantumAI injection for manually injected lead..."
      );
      try {
        // Generate proxy configuration for QuantumAI injection
        const { generateProxyConfig } = require("../utils/proxyManager");
        const proxyResult = await generateProxyConfig(lead.country);
        const quantumAIProxyConfig = proxyResult.config;

        console.log(
          `[DEBUG] Generated proxy for QuantumAI injection: ${lead.country}`
        );

        // Trigger QuantumAI injection
        runQuantumAIInjector(lead, quantumAIProxyConfig)
          .then((result) => {
            if (result.success) {
              console.log(
                "✅ QuantumAI injection completed successfully for manually injected lead:",
                lead._id
              );
            } else {
              console.error(
                "❌ QuantumAI injection failed for manually injected lead:",
                lead._id,
                result.error
              );
            }
          })
          .catch((error) => {
            console.error(
              "💥 QuantumAI injection error for manually injected lead:",
              lead._id,
              error
            );
          });
      } catch (error) {
        console.error(
          `[ERROR] Failed to generate proxy for QuantumAI injection:`,
          error
        );
        // Don't fail the main request if QuantumAI fails, just log the error
      }

      if (lead.leadType === "ftd") {
        const allFTDLeads = await Lead.find({
          _id: { $in: order.leads },
          leadType: "ftd",
        });
        const allFTDsInjected = allFTDLeads.every((ftdLead) => {
          const networkHistory = ftdLead.clientNetworkHistory?.find(
            (history) => history.orderId?.toString() === order._id.toString()
          );
          return (
            networkHistory && networkHistory.injectionStatus === "completed"
          );
        });
        if (allFTDsInjected) {
          order.ftdHandling.status = "completed";
          order.ftdHandling.completedAt = new Date();
          order.ftdHandling.notes =
            "All FTD leads manually injected and assigned to client brokers";
        }
        order.injectionProgress.ftdsPendingManualFill = Math.max(
          0,
          order.injectionProgress.ftdsPendingManualFill - 1
        );
      } else if (lead.leadType === "filler") {
        order.injectionProgress.successfulInjections =
          (order.injectionProgress.successfulInjections || 0) + 1;
      }
      await order.save();
      res.status(200).json({
        success: true,
        message: `Manual ${lead.leadType.toUpperCase()} injection completed successfully for this lead`,
        data: {
          leadId: lead._id,
          leadType: lead.leadType,
          domain: cleanDomain,
          clientBroker: {
            id: assignedBroker._id,
            name: assignedBroker.name,
            domain: assignedBroker.domain,
          },
        },
      });
    } catch (error) {
      console.error(
        `Error assigning client broker for ${lead.leadType.toUpperCase()} lead ${leadId}:`,
        error
      );
      return res.status(500).json({
        success: false,
        message: "Failed to assign client broker based on domain",
        error: error.message,
      });
    }
  } catch (error) {
    console.error(
      `Error completing manual injection for lead ${leadId}:`,
      error
    );
    next(error);
  }
};
