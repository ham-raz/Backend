import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";

import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [totalVideos, totalViewsResult, totalLikes, totalSubscribers] =
    await Promise.all([
      // Number of videos uploaded by this user
      Video.countDocuments({
        owner: userId,
      }),

      // Total views of this user's videos
      Video.aggregate([
        {
          $match: {
            owner: userId,
          },
        },
        {
          $group: {
            _id: null,
            totalViews: {
              $sum: "$views",
            },
          },
        },
      ]),

      // Total likes received on this user's videos
      Like.countDocuments({
        video: {
          $in: await Video.find({
            owner: userId,
          }).distinct("_id"),
        },
      }),

      // Number of users subscribed to this channel
      Subscription.countDocuments({
        channel: userId,
      }),
    ]);

  const totalViews = totalViewsResult[0]?.totalViews || 0;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalViews,
        totalSubscribers,
        totalLikes,
        totalVideos,
      },
      "Channel stats fetched successfully"
    )
  );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({
    owner: req.user._id,
  })
    .populate("owner", "username fullName avatar")
    .sort({
      createdAt: -1,
    });

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Channel videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };
