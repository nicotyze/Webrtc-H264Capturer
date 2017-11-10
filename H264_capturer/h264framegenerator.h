/*
 *  Copyright (c) 2010 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree. An additional intellectual property rights grant can be found
 *  in the file PATENTS.  All contributing project authors may
 *  be found in the AUTHORS file in the root of the source tree.
 */
// Generates YUV420 frames with a "landscape with striped crosshair" in the
// Y-plane, plus a horizontal gradient in the U-plane and a vertical one in the
// V-plane. This makes for a nice mix of colours that is suited for both
// catching visual errors and making sure e.g. YUV->RGB/BGR conversion looks
// the same on different platforms.
// There is also a solid box bouncing around in the Y-plane, and two differently
// coloured lines bouncing horizontally and vertically in the U and V plane.
// This helps illustrating how the frame boundary goes, and can aid as a quite
// handy visual help for noticing e.g. packet loss if the frames are encoded
// and sent over the network.
#ifndef WEBRTC_MEDIA_BASE_H264FRAMEGENERATOR_H_
#define WEBRTC_MEDIA_BASE_H264FRAMEGENERATOR_H_


#define RCV 1

extern "C"
{
	#include "third_party/ffmpeg/libavcodec/avcodec.h"
	#include "third_party/ffmpeg/libavformat/avformat.h"
	#include "third_party/ffmpeg/libswscale/swscale.h"
}

struct receive_th{
    AVFormatContext *pFormatCtx;
    int videoStream;
    bool b_new_pkt;
    bool b_fill_buf;
    bool b_streaming;
    pthread_mutex_t new_pkt_mutex;
    pthread_cond_t new_pkt_cond;
    pthread_mutex_t fill_buff_mutex;
    pthread_cond_t fill_buff_cond;
    std::queue<AVPacket *> Pkt_buf_;
};

namespace cricket {
class h264FrameGenerator {
 public:
  // Constructs a frame-generator that produces frames of size |width|x|height|.
  // If |enable_barcode| is specified, barcodes can be included in the frames
  // when calling |GenerateNextFrame(uint8_t*, uint32_t)|. If |enable_barcode|
  // is |true| then |width|x|height| should be at least 160x100; otherwise this
  // constructor will abort.
  h264FrameGenerator();
  ~h264FrameGenerator();
  int InitFfmpegSession(const char *in_f_name);
#ifndef  RCV 
int GetNextFrame(AVFormatContext *pFormatCtx, AVCodecContext *pCodecCtx,
    int videoStream, AVPacket *packet,uint8_t *buffer);
#endif
  // Generate the next frame and return it in the provided |frame_buffer|. If
  // barcode_value is not |nullptr| the value referred by it will be encoded
  // into a barcode in the frame.  The value should in the range:
  // [0..9,999,999]. If the value exceeds this range or barcodes were not
  // requested in the constructor, this function will abort.
  int GenerateNextFrame(uint8_t* frame_buffer);
  void SetStreamingMode(bool b_isStreaming ){rcv_th_data.b_streaming = b_isStreaming;} 
  bool isStreamed(){return rcv_th_data.b_streaming;}
  int getFrameWidth(){return width_;}
  int getFrameHeight(){return height_;}
  int getFrameRate(){return frameRate_;}
  void setWaitState(bool b_wait){b_is_waiting_ = b_wait;}

 private:
  int width_;
  int height_;
  int frameRate_;
  bool b_is_waiting_ ;
  AVFormatContext *pFormatCtx;
  AVCodecContext  *pCodecCtx;
  AVCodec         *pCodec;
  int             videoStream;
  struct receive_th rcv_th_data;

  RTC_DISALLOW_COPY_AND_ASSIGN(h264FrameGenerator);
};
}  // namespace cricket
#endif  // WEBRTC_MEDIA_BASE_H264FRAMEGENERATOR_H_
