import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const pageNumber = Math.max(Number(page), 1);
  const limitNumber = Math.max(Number(limit), 1);

  const filter = {};

  if (query?.trim()) {
    filter.$or = [
      { title: { $regex: query.trim(), $options: "i" } },
      { description: { $regex: query.trim(), $options: "i" } },
    ];
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid userId");
    }

    filter.owner = userId;
  }

  const sort = {
    [sortBy]: sortType === "asc" ? 1 : -1,
  };

  const videos = await Video.find(filter)
    .populate("owner", "username fullName avatar")
    .sort(sort)
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber);

  const totalVideos = await Video.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        videos,
        page: pageNumber,
        limit: limitNumber,
        totalVideos,
        totalPages: Math.ceil(totalVideos / limitNumber),
      },
      "Videos fetched successfully"
    )
  );
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title?.trim() || !description?.trim()) {
    throw new ApiError(400, "Title and description are required");
  }

  const videoFile = req.files?.videoFile?.[0];
  const thumbnail = req.files?.thumbnail?.[0];

  if (!videoFile) {
    throw new ApiError(400, "Video file is required");
  }

  if (!thumbnail) {
    throw new ApiError(400, "Thumbnail is required");
  }

  const uploadedVideo = await uploadOnCloudinary(videoFile.path);

  if (!uploadedVideo) {
    throw new ApiError(500, "Video upload failed");
  }

  const uploadedThumbnail = await uploadOnCloudinary(thumbnail.path);

  if (!uploadedThumbnail) {
    throw new ApiError(500, "Thumbnail upload failed");
  }

  const video = await Video.create({
    videoFile: uploadedVideo.secure_url,
    thumbnail: uploadedThumbnail.secure_url,
    title: title.trim(),
    description: description.trim(),
    duration: uploadedVideo.duration,
    owner: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId).populate(
    "owner",
    "username fullName avatar"
  );

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Increase views whenever the video is successfully fetched
  video.views += 1;
  await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  if (title !== undefined) {
    if (!title.trim()) {
      throw new ApiError(400, "Title cannot be empty");
    }

    video.title = title.trim();
  }

  if (description !== undefined) {
    if (!description.trim()) {
      throw new ApiError(400, "Description cannot be empty");
    }

    video.description = description.trim();
  }

  if (req.file) {
    const uploadedThumbnail = await uploadOnCloudinary(req.file.path);

    if (!uploadedThumbnail) {
      throw new ApiError(500, "Thumbnail upload failed");
    }

    video.thumbnail = uploadedThumbnail.secure_url;
  }

  await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  await Video.findByIdAndDelete(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You are not authorized to change this video's publish status"
    );
  }

  video.isPublished = !video.isPublished;

  await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        video,
        `Video ${video.isPublished ? "published" : "unpublished"} successfully`
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
