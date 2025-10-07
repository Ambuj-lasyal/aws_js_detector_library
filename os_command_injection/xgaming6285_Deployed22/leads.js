const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const { spawn } = require("child_process");
const express = require("express");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");

// @desc    Get all leads with filtering and pagination
// @route   GET /api/leads
// @access  Private (Admin, Affiliate Manager)
exports.getLeads = async (req, res, next) => {
  try {
    const {
      leadType,
      isAssigned,
      country,
      gender,
      status,
      documentStatus,
      page = 1,
      limit = 10,
      search,
      includeConverted = "true",
      order = "newest",
      orderId,
      assignedToMe,
    } = req.query;

    // Build filter object
    const filter = {};
    if (leadType) filter.leadType = leadType;
    if (isAssigned !== undefined && isAssigned !== "")
      filter.isAssigned = isAssigned === "true";
    if (country) filter.country = new RegExp(country, "i");
    if (gender) filter.gender = gender;
    if (orderId) filter.orderId = new mongoose.Types.ObjectId(orderId);

    // Determine sort order based on order parameter
    let sortOrder = { createdAt: -1 };
    switch (order) {
      case "oldest":
        sortOrder = { createdAt: 1 };
        break;
      case "name_asc":
        sortOrder = { firstName: 1, lastName: 1 };
        break;
      case "name_desc":
        sortOrder = { firstName: -1, lastName: -1 };
        break;
      default:
        sortOrder = { createdAt: -1 };
    }

    // Role-based filtering
    if (req.user.role === "affiliate_manager") {
      if (assignedToMe === "true") {
        filter.assignedTo = req.user.id;
        filter.isAssigned = true;
      }
    } else if (req.user.role === "lead_manager") {
      filter.createdBy = req.user.id;
    }

    // Only apply status filter if includeConverted is false or if status is specifically requested
    if (status) {
      filter.status = status;
    } else if (includeConverted !== "true") {
      filter.status = { $ne: "converted" };
    }

    if (documentStatus) filter["documents.status"] = documentStatus;

    // Add search functionality - use text index for better performance when possible
    if (search) {
      // If search is a simple term, use text index for better performance
      if (
        search.length > 3 &&
        !search.includes(":") &&
        !search.includes("?") &&
        !search.includes("*") &&
        !search.includes("(") &&
        !search.includes(")")
      ) {
        filter.$text = { $search: search };
      } else {
        // Fallback to regex for complex search patterns
        filter.$or = [
          { firstName: new RegExp(search, "i") },
          { lastName: new RegExp(search, "i") },
          { newEmail: new RegExp(search, "i") },
          { newPhone: new RegExp(search, "i") },
          { client: new RegExp(search, "i") },
        ];
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const limitNum = parseInt(limit);

    // Use aggregation for better performance with large datasets
    const aggregationPipeline = [
      { $match: filter },
      { $sort: sortOrder },
      { $skip: skip },
      { $limit: limitNum },
      // Populate with efficient lookups
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedToUser",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderDetails",
        },
      },
      // Unwind arrays to normalize the data structure
      {
        $addFields: {
          assignedTo: { $arrayElemAt: ["$assignedToUser", 0] },
          order: { $arrayElemAt: ["$orderDetails", 0] },
        },
      },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          prefix: 1,
          newEmail: 1,
          newPhone: 1,
          oldEmail: 1,
          oldPhone: 1,
          country: 1,
          leadType: 1,
          isAssigned: 1,
          assignedAt: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          gender: 1,
          client: 1,
          assignedClientBrokers: 1,
          documents: 1,
          "assignedTo._id": 1,
          "assignedTo.fullName": 1,
          "assignedTo.fourDigitCode": 1,
          "order._id": 1,
          "order.status": 1,
          "order.priority": 1,
          "order.createdAt": 1,
        },
      },
    ];

    // Execute aggregation pipeline
    const leads = await Lead.aggregate(aggregationPipeline);

    // Get total count for pagination (using countDocuments with the same filter)
    const total = await Lead.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLeads: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get assigned leads for agent
// @route   GET /api/leads/assigned
// @access  Private (Agent)
exports.getAssignedLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, orderId, leadType } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object - use an efficient filtering approach
    const filter = {
      assignedTo: new mongoose.Types.ObjectId(req.user.id),
      isAssigned: true,
    };

    // Apply optional filters only if provided
    if (status) filter.status = status;
    if (orderId) filter.orderId = new mongoose.Types.ObjectId(orderId);
    if (leadType) filter.leadType = leadType;

    // Use promise.all to run count and data queries in parallel
    const [results, totalCount] = await Promise.all([
      Lead.aggregate([
        { $match: filter },
        { $sort: { assignedAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "assignedTo",
            foreignField: "_id",
            as: "assignedToDetails",
            pipeline: [
              {
                $project: {
                  fullName: 1,
                  fourDigitCode: 1,
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderDetails",
            pipeline: [
              {
                $project: {
                  status: 1,
                  priority: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            prefix: 1,
            newEmail: 1,
            country: 1,
            leadType: 1,
            isAssigned: 1,
            assignedAt: 1,
            status: 1,
            createdAt: 1,
            "assignedToDetails.fullName": 1,
            "assignedToDetails.fourDigitCode": 1,
            "orderDetails.status": 1,
            "orderDetails.priority": 1,
            "orderDetails.createdAt": 1,
          },
        },
      ]),
      Lead.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalLeads: totalCount,
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead by ID
// @route   GET /api/leads/:id
// @access  Private (Admin or assigned agent)
exports.getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "fullName fourDigitCode email")
      .populate("comments.author", "fullName fourDigitCode");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this lead",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to lead
// @route   PUT /api/leads/:id/comment
// @access  Private (Admin, Affiliate Manager, or assigned agent)
exports.addComment = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { text } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to comment on this lead",
        });
      }
    }

    // Add comment
    const comment = {
      text,
      author: req.user.id,
      createdAt: new Date(),
    };

    lead.comments.push(comment);
    await lead.save();

    // Populate the newly added comment
    await lead.populate("comments.author", "fullName fourDigitCode");

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lead status
// @route   PUT /api/leads/:id/status
// @access  Private (Admin, Affiliate Manager, or assigned agent)
exports.updateLeadStatus = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { status, documentStatus } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this lead",
        });
      }
    }

    // Update fields
    if (status) lead.status = status;
    if (documentStatus && lead.documents) {
      lead.documents.status = documentStatus;
    }

    await lead.save();

    // Populate for response
    await lead.populate("assignedTo", "fullName fourDigitCode");

    res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead statistics
// @route   GET /api/leads/stats
// @access  Private (Admin, Affiliate Manager)
exports.getLeadStats = async (req, res, next) => {
  try {
    let matchCondition = {};

    // Role-based filtering for stats
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can see stats for all leads to manage assignments
      // No additional filtering needed
    }

    // Build aggregation pipeline with role-based match condition
    const pipeline = [];
    if (Object.keys(matchCondition).length > 0) {
      pipeline.push({ $match: matchCondition });
    }

    pipeline.push({
      $group: {
        _id: {
          leadType: "$leadType",
          isAssigned: "$isAssigned",
        },
        count: { $sum: 1 },
      },
    });

    const stats = await Lead.aggregate(pipeline);

    // Transform aggregation result into a more readable format
    const formattedStats = {
      ftd: { assigned: 0, available: 0, total: 0 },
      filler: { assigned: 0, available: 0, total: 0 },
      cold: { assigned: 0, available: 0, total: 0 },
      live: { assigned: 0, available: 0, total: 0 },
      overall: { assigned: 0, available: 0, total: 0 },
    };

    stats.forEach((stat) => {
      const { leadType, isAssigned } = stat._id;
      const count = stat.count;

      if (formattedStats[leadType]) {
        if (isAssigned) {
          formattedStats[leadType].assigned = count;
        } else {
          formattedStats[leadType].available = count;
        }
        formattedStats[leadType].total += count;

        // Update overall stats
        if (isAssigned) {
          formattedStats.overall.assigned += count;
        } else {
          formattedStats.overall.available += count;
        }
        formattedStats.overall.total += count;
      }
    });

    // Get document status stats for FTD leads with role-based filtering
    const documentStatsPipeline = [
      {
        $match: {
          leadType: "ftd",
          ...matchCondition,
        },
      },
      {
        $group: {
          _id: "$documents.status",
          count: { $sum: 1 },
        },
      },
    ];

    const documentStats = await Lead.aggregate(documentStatsPipeline);

    const formattedDocumentStats = {
      good: 0,
      ok: 0,
      pending: 0,
    };

    documentStats.forEach((stat) => {
      if (formattedDocumentStats.hasOwnProperty(stat._id)) {
        formattedDocumentStats[stat._id] = stat.count;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        leads: formattedStats,
        documents: formattedDocumentStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign leads to agent
// @route   PUT /api/leads/assign
// @access  Private (Admin/Affiliate Manager only)
// @desc    Assign leads to agent
// @route   PUT /api/leads/assign
// @access  Private (Admin/Affiliate Manager only)
exports.assignLeads = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { leadIds, agentId } = req.body;

    // Validate agent exists and is active
    const agent = await User.findById(agentId);

    // FIX: The check now ensures the agent is not only active but also approved
    if (
      !agent ||
      agent.role !== "agent" ||
      !agent.isActive ||
      agent.status !== "approved"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive/unapproved agent selected.",
      });
    }

    // Build the update condition based on role
    let updateCondition = {
      _id: { $in: leadIds },
    };

    // Role-based filtering for affiliate managers
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can assign any leads for management purposes
      // No additional filtering needed - they can reassign any lead by ID
    } else if (req.user.role === "admin") {
      // Admins can assign any lead (both unassigned and reassign already assigned ones)
      // No additional filtering needed - they can assign any lead by ID
    }

    // Update leads
    console.log("Assigning leads with:", {
      updateCondition,
      agentId,
      agentName: agent.fullName,
      agentCode: agent.fourDigitCode,
    });

    const result = await Lead.updateMany(updateCondition, {
      $set: {
        isAssigned: true,
        assignedTo: agentId,
        assignedAt: new Date(),
      },
    });

    console.log("Assignment result:", result);

    // Verify the assignment worked by checking a few leads
    const verifyLeads = await Lead.find({ _id: { $in: leadIds } })
      .populate("assignedTo", "fullName fourDigitCode email")
      .limit(3);

    console.log(
      "Verification - First few assigned leads:",
      verifyLeads.map((lead) => ({
        id: lead._id,
        isAssigned: lead.isAssigned,
        assignedTo: lead.assignedTo
          ? {
            id: lead.assignedTo._id,
            fullName: lead.assignedTo.fullName,
            fourDigitCode: lead.assignedTo.fourDigitCode,
          }
          : null,
      }))
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads assigned successfully`,
      data: {
        assignedCount: result.modifiedCount,
        agentName: agent.fullName,
        agentCode: agent.fourDigitCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unassign leads from agent
// @route   PUT /api/leads/unassign
// @access  Private (Admin/Affiliate Manager only)
exports.unassignLeads = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { leadIds } = req.body;

    // Build the update condition based on role
    let updateCondition = {
      _id: { $in: leadIds },
      isAssigned: true,
    };

    // Role-based filtering for affiliate managers
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can unassign any leads for management purposes
      // No additional filtering needed - they can unassign any lead by ID
    }

    // Update leads
    const result = await Lead.updateMany(updateCondition, {
      $set: {
        isAssigned: false,
      },
      $unset: {
        assignedTo: 1,
        assignedAt: 1,
      },
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads unassigned successfully`,
      data: {
        unassignedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign client broker to individual lead
// @route   PUT /api/leads/:id/assign-client-broker
// @access  Private (Admin, Affiliate Manager)
exports.assignClientBrokerToLead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const leadId = req.params.id;
    const { clientBrokerId, client, intermediaryClientNetwork, domain } = req.body;

    // Find the lead and client broker
    const [lead, clientBroker] = await Promise.all([
      Lead.findById(leadId),
      ClientBroker.findById(clientBrokerId)
    ]);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    // Check if user has permission to assign client brokers
    if (!['admin', 'affiliate_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can assign client brokers.",
      });
    }

    if (!clientBroker.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign lead to inactive client broker",
      });
    }

    // Check if this lead has already been assigned to this client broker
    if (lead.isAssignedToClientBroker(clientBrokerId)) {
      return res.status(400).json({
        success: false,
        message: `Lead "${lead.firstName} ${lead.lastName}" is already assigned to client broker "${clientBroker.name}".`,
        data: {
          leadId: lead._id,
          leadName: `${lead.firstName} ${lead.lastName}`,
          clientBroker: clientBroker.name,
        }
      });
    }

    // Assign the client broker to the lead
    lead.assignClientBroker(
      clientBrokerId,
      req.user.id,
      lead.orderId,
      intermediaryClientNetwork,
      domain
    );

    // Update client field if provided
    if (client !== undefined) {
      lead.client = client;
    }

    // Update the client broker
    clientBroker.assignLead(leadId);

    // Save both documents
    await Promise.all([lead.save(), clientBroker.save()]);

    // Populate the response
    const updatedLead = await Lead.findById(leadId)
      .populate('assignedTo', 'fullName fourDigitCode email')
      .populate('assignedClientBrokers', 'name domain');

    res.status(200).json({
      success: true,
      message: `Successfully assigned client broker "${clientBroker.name}" to lead "${lead.firstName} ${lead.lastName}"`,
      data: updatedLead,
    });
  } catch (error) {
    console.error("Assign client broker to lead error:", error);
    next(error);
  }
};

// @desc    Get lead assignment history
// @route   GET /api/leads/:id/assignment-history
// @access  Private (Admin, Affiliate Manager)
exports.getLeadAssignmentHistory = async (req, res, next) => {
  try {
    const leadId = req.params.id;

    const lead = await Lead.findById(leadId)
      .populate('clientBrokerHistory.assignedBy', 'fullName fourDigitCode email')
      .populate('clientBrokerHistory.orderId', 'status createdAt')
      .populate('clientBrokerHistory.clientBroker', 'name domain')
      .populate('clientBrokerHistory.intermediaryClientNetwork', 'name')
      .populate('assignedClientBrokers', 'name domain');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if user has permission to view assignment history
    if (!['admin', 'affiliate_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can view assignment history.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        leadId: lead._id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        currentAssignments: {
          clientBrokers: lead.assignedClientBrokers.map(broker => ({
            id: broker._id,
            name: broker.name,
            domain: broker.domain
          })),
          client: lead.client
        },
        assignmentHistory: lead.clientBrokerHistory.map(history => ({
          clientBroker: {
            id: history.clientBroker._id,
            name: history.clientBroker.name,
            domain: history.clientBroker.domain
          },
          intermediaryClientNetwork: history.intermediaryClientNetwork ? {
            id: history.intermediaryClientNetwork._id,
            name: history.intermediaryClientNetwork.name
          } : null,
          assignedAt: history.assignedAt,
          assignedBy: history.assignedBy,
          orderId: history.orderId,
          orderStatus: history.orderId ? history.orderId.status : null,
          orderCreatedAt: history.orderId ? history.orderId.createdAt : null,
          injectionStatus: history.injectionStatus,
          domain: history.domain
        }))
      }
    });
  } catch (error) {
    console.error("Get lead assignment history error:", error);
    next(error);
  }
};

// @desc    Get client broker assignment analytics
// @route   GET /api/leads/client-broker-analytics
// @access  Private (Admin, Affiliate Manager)
exports.getClientBrokerAnalytics = async (req, res, next) => {
  try {
    const { orderId } = req.query;

    // Check if user has permission
    if (!['admin', 'affiliate_manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can view analytics.",
      });
    }

    let matchStage = {};
    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID format",
        });
      }
      matchStage.orderId = new mongoose.Types.ObjectId(orderId);
    }

    // Aggregate client broker assignment data
    const analytics = await Lead.aggregate([
      { $match: matchStage },
      { $unwind: { path: "$clientBrokerHistory", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "clientbrokers",
          localField: "clientBrokerHistory.clientBroker",
          foreignField: "_id",
          as: "brokerDetails"
        }
      },
      { $unwind: { path: "$brokerDetails", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            clientBroker: "$clientBrokerHistory.clientBroker",
            orderId: "$clientBrokerHistory.orderId"
          },
          brokerName: { $first: "$brokerDetails.name" },
          brokerDomain: { $first: "$brokerDetails.domain" },
          totalAssignments: { $sum: 1 },
          uniqueLeads: { $addToSet: "$_id" },
          firstAssignment: { $min: "$clientBrokerHistory.assignedAt" },
          lastAssignment: { $max: "$clientBrokerHistory.assignedAt" },
          injectionStatuses: { $addToSet: "$clientBrokerHistory.injectionStatus" }
        }
      },
      {
        $group: {
          _id: "$_id.clientBroker",
          brokerName: { $first: "$brokerName" },
          brokerDomain: { $first: "$brokerDomain" },
          totalAssignments: { $sum: "$totalAssignments" },
          totalUniqueLeads: { $sum: { $size: "$uniqueLeads" } },
          orderBreakdown: {
            $push: {
              orderId: "$_id.orderId",
              assignments: "$totalAssignments",
              uniqueLeads: { $size: "$uniqueLeads" },
              firstAssignment: "$firstAssignment",
              lastAssignment: "$lastAssignment",
              injectionStatuses: "$injectionStatuses"
            }
          }
        }
      },
      {
        $project: {
          clientBrokerId: "$_id",
          brokerName: 1,
          brokerDomain: 1,
          totalAssignments: 1,
          totalUniqueLeads: 1,
          orderBreakdown: 1,
          _id: 0
        }
      },
      { $sort: { totalAssignments: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        analytics,
        totalClientBrokers: analytics.length,
        totalAssignments: analytics.reduce((sum, item) => sum + item.totalAssignments, 0),
        totalUniqueLeads: analytics.reduce((sum, item) => sum + item.totalUniqueLeads, 0)
      }
    });
  } catch (error) {
    console.error("Get client broker analytics error:", error);
    next(error);
  }
};

// @desc    Update lead information
// @route   PUT /api/leads/:id
// @access  Private (Admin, Affiliate Manager)
exports.updateLead = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      status,
      documents,
      leadType,
      socialMedia,
      sin,
      gender,
      address,
    } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if lead manager is trying to update a lead they didn't create
    if (
      req.user.role === "lead_manager" &&
      lead.createdBy &&
      lead.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only edit leads that you created",
      });
    }

    // Update fields if provided
    if (firstName) lead.firstName = firstName;
    if (lastName) lead.lastName = lastName;
    if (newEmail) lead.newEmail = newEmail;
    if (oldEmail !== undefined) lead.oldEmail = oldEmail;
    if (newPhone) lead.newPhone = newPhone;
    if (oldPhone !== undefined) lead.oldPhone = oldPhone;
    if (country) lead.country = country;
    if (status) lead.status = status;
    if (leadType) lead.leadType = leadType;
    if (sin !== undefined && leadType === "ftd") lead.sin = sin;
    if (gender !== undefined) lead.gender = gender;

    // Update address if provided and lead type is appropriate
    if (
      address !== undefined &&
      (lead.leadType === "ftd" || lead.leadType === "filler")
    ) {
      // Address will be handled by pre-save middleware to ensure it's a string
      lead.address = address;
    }

    // Update social media fields if provided
    if (socialMedia) {
      lead.socialMedia = {
        ...lead.socialMedia,
        ...socialMedia,
      };
    }

    // Update documents if provided
    if (documents) {
      lead.documents = documents;
    }

    await lead.save();

    // Populate for response
    await lead.populate("assignedTo", "fullName fourDigitCode");
    await lead.populate("comments.author", "fullName");

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private (Admin, Affiliate Manager, Lead Manager)
exports.createLead = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      client,
      clientBroker,
      clientNetwork,
      dob,
      address,
      gender,
      documents,
    } = req.body;

    // Check if a lead with this email already exists
    const existingLead = await Lead.findOne({
      newEmail: newEmail.toLowerCase(),
    });
    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }

    // Create lead data object
    const leadData = {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      client,
      clientBroker,
      clientNetwork,
      dob,
      address,
      gender,
      createdBy: req.user.id,
      isAssigned: false,
      status: "active",
    };

    // Set documents based on lead type
    if (leadType === "ftd") {
      if (documents && Array.isArray(documents) && documents.length > 0) {
        leadData.documents = documents;
      } else {
        leadData.documents = {
          status: "pending",
        };
      }
    } else {
      leadData.documents = documents || [];
    }

    // Create a new lead
    const lead = new Lead(leadData);
    await lead.save();

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    // Handle other MongoDB errors
    if (error.code === 11000 && error.keyPattern?.newEmail) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: error.keyValue.newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }
    next(error);
  }
};

// Utility function to handle batch operations efficiently
const batchProcess = async (items, batchSize, processFn) => {
  const results = [];
  const totalItems = items.length;
  const totalBatches = Math.ceil(totalItems / batchSize);

  console.log(
    `Starting batch processing of ${totalItems} items in ${totalBatches} batches`
  );

  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    console.log(
      `Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`
    );

    const batchResults = await processFn(batch);
    if (Array.isArray(batchResults)) {
      results.push(...batchResults);
    } else {
      results.push(batchResults);
    }

    // Small pause between batches to prevent overwhelming the database
    if (i + batchSize < totalItems) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
};

// @desc    Import leads from CSV or JSON
// @route   POST /api/leads/import
// @access  Private (Admin, Lead Manager)
exports.importLeads = async (req, res, next) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
    }

    const file = req.files.file;
    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (!["csv", "json"].includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV or JSON file",
      });
    }

    let leads = [];

    if (fileExtension === "csv") {
      // Parse CSV file
      const results = [];
      const stream = Readable.from(file.data.toString());

      await new Promise((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on("data", (data) => results.push(data))
          .on("error", (error) => reject(error))
          .on("end", () => resolve());
      });

      leads = results;
    } else {
      // Parse JSON file
      try {
        leads = JSON.parse(file.data.toString());
        if (!Array.isArray(leads)) {
          leads = [leads]; // Convert single object to array
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format",
        });
      }
    }

    // Helper function to parse date from DD/MM/YYYY format
    const parseDate = (dateString) => {
      if (!dateString) return null;

      // Handle DD/MM/YYYY format
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const year = parseInt(parts[2]);

        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }

      // Try to parse as regular date if above fails
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    // Helper function to normalize gender
    const normalizeGender = (gender) => {
      if (!gender) return "not_defined";

      const genderLower = gender.toLowerCase();
      if (genderLower === "male" || genderLower === "m") return "male";
      if (genderLower === "female" || genderLower === "f") return "female";
      return "not_defined";
    };

    // Process and validate leads
    const processedLeads = leads.map((lead) => {
      const leadData = {
        firstName:
          lead.firstName ||
          lead.first_name ||
          lead["First name"] ||
          lead["first name"] ||
          "",
        lastName:
          lead.lastName ||
          lead.last_name ||
          lead["Last name"] ||
          lead["last name"] ||
          "",
        newEmail:
          lead.email ||
          lead.newEmail ||
          lead.Email ||
          lead["Email"] ||
          lead["new email"] ||
          "",
        oldEmail: lead.oldEmail || lead["old email"] || "",
        newPhone:
          lead.phone ||
          lead.newPhone ||
          lead["Phone number"] ||
          lead["phone number"] ||
          lead.Phone ||
          lead["new phone"] ||
          "",
        oldPhone: lead.oldPhone || lead["old phone"] || "",
        country: lead.country || lead.Country || lead.GEO || lead.geo || "",
        gender: normalizeGender(lead.gender || lead.Gender || ""),
        prefix: lead.prefix || lead.Prefix || "",
        dob: parseDate(lead.dob || lead.DOB || lead["Date of birth"] || ""),
        address: lead.address || lead.Address || "",
        leadType:
          req.body.leadType || lead.leadType || lead.lead_type || "cold",
        createdBy: req.user.id,
      };

      // Add social media fields
      const socialMedia = {};
      if (lead.Facebook || lead.facebook)
        socialMedia.facebook = lead.Facebook || lead.facebook;
      if (lead.Twitter || lead.twitter)
        socialMedia.twitter = lead.Twitter || lead.twitter;
      if (lead.Linkedin || lead.linkedin)
        socialMedia.linkedin = lead.Linkedin || lead.linkedin;
      if (lead.Instagram || lead.instagram)
        socialMedia.instagram = lead.Instagram || lead.instagram;
      if (lead.Telegram || lead.telegram)
        socialMedia.telegram = lead.Telegram || lead.telegram;
      if (lead.WhatsApp || lead.whatsapp)
        socialMedia.whatsapp = lead.WhatsApp || lead.whatsapp;

      if (Object.keys(socialMedia).length > 0) {
        leadData.socialMedia = socialMedia;
      }

      // Add documents for image URLs
      const documents = [];
      const idFront = lead["ID front"] || lead["id front"] || lead.id_front;
      const idBack = lead["ID back"] || lead["id back"] || lead.id_back;
      const selfieFront =
        lead["Selfie front"] || lead["selfie front"] || lead.selfie_front;
      const selfieBack =
        lead["Selfie back"] || lead["selfie back"] || lead.selfie_back;

      if (idFront && idFront.trim()) {
        documents.push({
          url: idFront.trim(),
          description: "ID Front",
        });
      }
      if (idBack && idBack.trim()) {
        documents.push({
          url: idBack.trim(),
          description: "ID Back",
        });
      }
      if (selfieFront && selfieFront.trim()) {
        documents.push({
          url: selfieFront.trim(),
          description: "Selfie with ID Front",
        });
      }
      if (selfieBack && selfieBack.trim()) {
        documents.push({
          url: selfieBack.trim(),
          description: "Selfie with ID Back",
        });
      }

      if (documents.length > 0) {
        leadData.documents = documents;
      }

      // Add SIN for FTD leads (only if available)
      if (leadData.leadType === "ftd") {
        const sinValue =
          lead.sin || lead.SIN || lead["Social Insurance Number"] || "";
        if (sinValue && sinValue.trim().length > 0) {
          leadData.sin = sinValue.trim();
        }
        // Don't add sin field if it's empty - let the database handle it
      }

      return leadData;
    });

    const validLeads = processedLeads.filter(
      (lead) =>
        lead.firstName && lead.newEmail && (lead.newPhone || lead.country)
    );

    // Debug logging
    console.log(`Total leads parsed: ${processedLeads.length}`);
    console.log(`Valid leads after filtering: ${validLeads.length}`);

    if (processedLeads.length > 0) {
      console.log("Sample parsed lead:", processedLeads[0]);
      console.log("Raw lead data sample:", leads[0]);
    }

    if (validLeads.length > 0) {
      console.log("Sample valid lead:", validLeads[0]);
    } else {
      console.log("Invalid leads sample (first 5):");
      processedLeads.slice(0, 5).forEach((lead, index) => {
        console.log(`Lead ${index + 1}:`, {
          firstName: lead.firstName,
          newEmail: lead.newEmail,
          newPhone: lead.newPhone,
          country: lead.country,
          isValid: !!(
            lead.firstName &&
            lead.newEmail &&
            (lead.newPhone || lead.country)
          ),
          validationDetails: {
            hasFirstName: !!lead.firstName,
            hasEmail: !!lead.newEmail,
            hasPhoneOrCountry: !!(lead.newPhone || lead.country),
          },
        });
      });
    }

    if (validLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid leads found in the file",
      });
    }

    // Use batch processing for better performance
    const BATCH_SIZE = 100; // Process in batches of 100

    const savedLeads = await batchProcess(
      validLeads,
      BATCH_SIZE,
      async (batch) => {
        // Check for existing emails in this batch to avoid duplicates
        const emails = batch.map((lead) => lead.newEmail);
        const existingEmails = await Lead.distinct("newEmail", {
          newEmail: { $in: emails },
        });

        console.log(`Batch processing: ${batch.length} leads in batch`);
        console.log(
          `Found ${existingEmails.length} existing emails:`,
          existingEmails.slice(0, 5)
        );

        // Filter out leads with existing emails
        const newLeads = batch.filter(
          (lead) => !existingEmails.includes(lead.newEmail)
        );

        console.log(
          `After duplicate filtering: ${newLeads.length} new leads to insert`
        );

        if (newLeads.length === 0) {
          console.log("No new leads to insert - all were duplicates");
          return [];
        }

        console.log(`Inserting ${newLeads.length} new leads...`);

        // Use insertMany for better performance
        const result = await Lead.insertMany(newLeads, {
          ordered: false, // Continue inserting despite errors
          rawResult: true, // Return statistics about the operation
        });

        console.log("Insert result:", result);

        // Log validation errors if any
        if (
          result.mongoose &&
          result.mongoose.validationErrors &&
          result.mongoose.validationErrors.length > 0
        ) {
          console.log("Validation errors found:");
          result.mongoose.validationErrors
            .slice(0, 3)
            .forEach((error, index) => {
              console.log(`Validation error ${index + 1}:`, error.message);
              console.log("Error details:", error);
            });
        }

        return result;
      }
    );

    // Count successful imports
    let importCount = 0;
    savedLeads.forEach((result) => {
      if (result.insertedCount) importCount += result.insertedCount;
    });

    res.status(200).json({
      success: true,
      message: `${importCount} leads imported successfully`,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      return res.status(400).json({
        success: false,
        message: "Some leads could not be imported due to duplicate emails",
      });
    }
    next(error);
  }
};

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Private (Admin only)
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Only admin can delete leads
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }

    await lead.deleteOne();

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Inject a lead into the automation script
// @route   POST /api/v1/leads/:id/inject
// @access  Private/Admin
exports.injectLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const landingPage = req.body.landingPage;
    if (!landingPage) {
      return res.status(400).json({
        success: false,
        message: "Landing page URL is required",
      });
    }

    const leadData = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone,
      country: lead.country,
      country_code: lead.prefix || "1", // Default to US/Canada if no prefix
      landingPage,
      password: "TPvBwkO8", // This should be stored securely
    };

    console.log('Starting Python script with lead data:', leadData);

    // Use path.join for cross-platform compatibility
    const path = require('path');
    const scriptPath = path.resolve(path.join(__dirname, '..', '..', 'injector_playwright.py'));

    console.log('Python script path:', scriptPath);

    // Check if the script exists
    const fs = require('fs');
    if (!fs.existsSync(scriptPath)) {
      console.error('Python script not found at:', scriptPath);
      return res.status(500).json({
        success: false,
        message: "Injection script not found",
        details: `Script not found at ${scriptPath}`
      });
    }

    // Check if Python is installed
    try {
      const pythonCheck = spawn("python", ["--version"]);
      pythonCheck.on("error", (error) => {
        console.error('Python not found:', error);
        return res.status(500).json({
          success: false,
          message: "Python not installed or not in PATH",
          error: error.message
        });
      });
    } catch (error) {
      console.error('Failed to check Python:', error);
    }

    // Launch the Python script with properly encoded JSON
    const pythonProcess = spawn("python", [
      scriptPath,
      JSON.stringify(leadData)
    ], {
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        RENDER: process.env.RENDER || 'false',
        VERCEL: process.env.VERCEL || '0',
        DOCKER: process.env.DOCKER || 'false'
      }
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdoutData += output;
      console.log(`Python Script Output: ${output}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      stderrData += error;
      console.error(`Python Script Error: ${error}`);
    });

    pythonProcess.on("error", (error) => {
      console.error('Failed to start Python process:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to start injection process",
        error: error.message
      });
    });

    pythonProcess.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code === 0) {
        res.status(200).json({
          success: true,
          message: "Injection process completed successfully.",
          output: stdoutData
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Injection process failed with exit code ${code}`,
          error: stderrData,
          output: stdoutData
        });
      }
    });

  } catch (error) {
    console.error('Server error during injection:', error);
    res.status(500).json({
      success: false,
      message: "Server error during injection.",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete multiple leads with filtering
// @route   DELETE /api/leads/bulk-delete
// @access  Private (Admin only)
exports.bulkDeleteLeads = async (req, res, next) => {
  try {
    // Only admin can delete leads
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }

    const {
      leadType,
      country,
      gender,
      status,
      documentStatus,
      isAssigned,
      search,
    } = req.body;

    // Build filter object
    const filter = {};
    if (leadType) filter.leadType = leadType;
    if (country) filter.country = new RegExp(country, "i");
    if (gender) filter.gender = gender;
    if (status) filter.status = status;
    if (documentStatus) filter["documents.status"] = documentStatus;
    if (isAssigned !== undefined && isAssigned !== "") {
      filter.isAssigned = isAssigned === "true" || isAssigned === true;
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { newEmail: new RegExp(search, "i") },
        { oldEmail: new RegExp(search, "i") },
        { newPhone: new RegExp(search, "i") },
        { oldPhone: new RegExp(search, "i") }
      ];
    }

    const result = await Lead.deleteMany(filter);

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} leads deleted successfully`,
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check and wake up sleeping leads
// @route   POST /api/leads/wake-up-sleeping
// @access  Private (Admin only)
exports.wakeUpSleepingLeads = async (req, res, next) => {
  try {
    const Lead = require("../models/Lead");
    const ClientNetwork = require("../models/ClientNetwork");

    const sleepingLeads = await Lead.findSleepingLeads();
    let wokeUpCount = 0;

    if (sleepingLeads.length > 0) {
      // Get all active client networks with their brokers
      const clientNetworks = await ClientNetwork.find({ isActive: true });

      for (const lead of sleepingLeads) {
        let hasAvailableBrokers = false;

        // Check if any brokers are now available for this lead
        for (const network of clientNetworks) {
          if (network.clientBrokers && network.clientBrokers.length > 0) {
            const availableBrokers = network.clientBrokers
              .filter(broker => broker.isActive)
              .map(broker => broker.domain || broker.name);

            const assignedBrokers = lead.getAssignedClientBrokers();
            const hasNewBrokers = availableBrokers.some(broker => !assignedBrokers.includes(broker));

            if (hasNewBrokers) {
              hasAvailableBrokers = true;
              break;
            }
          }
        }

        if (hasAvailableBrokers) {
          lead.wakeUp();
          await lead.save();
          wokeUpCount++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Checked ${sleepingLeads.length} sleeping leads and woke up ${wokeUpCount}`,
      data: {
        totalSleepingLeads: sleepingLeads.length,
        wokeUpCount: wokeUpCount
      }
    });
  } catch (error) {
    next(error);
  }
};
