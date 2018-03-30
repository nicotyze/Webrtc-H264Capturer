/*
 *  Copyright (c) 2004 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree. An additional intellectual property rights grant can be found
 *  in the file PATENTS.  All contributing project authors may
 *  be found in the AUTHORS file in the root of the source tree.
 */

#include <string.h>
#include <sstream>
#include <cstddef>
#include <vector>
#include <queue>
#include "webrtc/modules/video_coding/codecs/h264/h264_decoder_impl.h"

#define PKT_BUF_LEN 1

void *receive(void *th_arg){

    struct receive_th *rcv_th_data;
    rcv_th_data = (receive_th*)th_arg;
    int err;
    AVPacket *dummy_packet;
    std::queue<AVPacket *> *Pkt_buf = &rcv_th_data->Pkt_buf_;

    while(1){

      AVPacket *packet=(AVPacket*)av_malloc(sizeof(AVPacket));
      packet->stream_index = -1;
      do{
        av_init_packet(packet);
        //av_free_packet(&packet);
        packet->data = NULL;
        err = av_read_frame(rcv_th_data->pFormatCtx,packet);
        if(err<0){
          //pthread_exit(NULL);
          //return 0 ;      
            if( rcv_th_data->b_streaming == false ){     
               av_seek_frame(rcv_th_data->pFormatCtx, -1, 0, AVSEEK_FLAG_BACKWARD);
               packet->stream_index = -1;
            }
            //fprintf(stderr, "#################### =======> av_seek_frame");
            continue;
        }
      }
      while( packet->stream_index != rcv_th_data->videoStream );

      pthread_mutex_lock(&rcv_th_data->fill_buff_mutex);
        //if(Pkt_buf.size()<PKT_BUF_LEN)
        rcv_th_data->b_fill_buf = Pkt_buf->size() < PKT_BUF_LEN;

      if(rcv_th_data->b_streaming == false){
        while( rcv_th_data->b_fill_buf == 0 )
          pthread_cond_wait(&rcv_th_data->fill_buff_cond, &rcv_th_data->fill_buff_mutex);
      }
      else{
#if 1
        if( rcv_th_data->b_fill_buf == 0 ){// if streaming mode is true, the receiving thread is never blocked and some packets can be dropped
          dummy_packet = Pkt_buf->front();
          Pkt_buf->pop();
          av_packet_unref(dummy_packet);
        }
#endif
      }
            //AVPacket *packet = av_malloc(sizeof(AVPacket));
            //av_frame_ref (pFrame_ref,decode_th_data->pFrame);
            Pkt_buf->push(packet);
      pthread_mutex_unlock(&rcv_th_data->fill_buff_mutex);

      pthread_mutex_lock(&rcv_th_data->new_pkt_mutex);
        rcv_th_data->b_new_pkt=true;
        pthread_cond_signal( &rcv_th_data->new_pkt_cond );
      pthread_mutex_unlock(&rcv_th_data->new_pkt_mutex);

    }
}

namespace cricket {

#ifndef  RCV
int h264FrameGenerator::GetNextFrame(AVFormatContext *pFormatCtx, AVCodecContext *pCodecCtx,
    int videoStream,AVPacket *packet,uint8_t* frame_buffer)
{
    int err;
    static bool     fFirstTime = true;
    static AVPacket packet_bis;
    packet=(AVPacket*)(&packet_bis);//av_malloc(sizeof(AVPacket));

    // First time we're called, set packet.data to NULL to indicate it
    // doesn't have to be freed
    if (fFirstTime) {
        fFirstTime = false;
        av_init_packet(packet);
        packet->data = NULL;
    }


read_pkt:
    do{
      av_packet_unref(packet);
      err = av_read_frame(pFormatCtx,packet);
    }
    while( packet->stream_index != videoStream );
        // Work on the current packet until we have decoded all of it
        if (packet->size > 0 && err>=0 && packet->data) {
                memset(frame_buffer,0x00,  width_ * height_);
                memcpy(frame_buffer, packet->data, packet->size);
                frame_buffer[packet->size] = 0x00;
                frame_buffer[packet->size+1] = 0x00;
                frame_buffer[packet->size+2] = 0x00;
                frame_buffer[packet->size+3] = 0x01;
                return 0;
        }
        else{
          goto loop_exit;
        }

loop_exit:

    av_seek_frame(pFormatCtx, -1, 0, AVSEEK_FLAG_BACKWARD);
    goto read_pkt;

    // Free last packet
    if (packet->data != NULL)
        av_packet_unref(packet);

    fprintf(stderr, "File finished");
    return -1;//frameFinished != 0;
}
#endif

h264FrameGenerator::h264FrameGenerator() {
#if 1
  webrtc::H264DecoderImpl *tmp_264_dec = new webrtc::H264DecoderImpl;
  tmp_264_dec->InitFFmpeg(); // Register all formats and codecs --> done in h264_decoder_impl.cc (only once)
#else
    avcodec_register_all();
    av_register_all();
    avformat_network_init();
#endif
}
h264FrameGenerator::~h264FrameGenerator() {
}
int h264FrameGenerator::InitFfmpegSession(const char *in_f_name){
    
    pFormatCtx = avformat_alloc_context();
    char white_list_proto[] = "file,udp,tcp,rtp,rtsp";
    pFormatCtx->protocol_whitelist = white_list_proto;

    int ret = avformat_open_input(&pFormatCtx, in_f_name , NULL, NULL);
    if ( ret != 0){
        char buff[256];
        av_strerror(ret, buff, 256);
        return -1; // Couldn't open file
    }

    // Retrieve stream information
    if (avformat_find_stream_info(pFormatCtx,NULL) < 0)
        return -1; // Couldn't find stream information

    // Find the first video stream
    videoStream = -1;
    for (unsigned int i = 0; i < pFormatCtx->nb_streams; i++) {
        AVCodecContext *cc = pFormatCtx->streams[i]->codec;
        if (cc->codec_type==AVMEDIA_TYPE_VIDEO) {
            // don't care FF_DEBUG_VIS_MV_B_BACK
            cc->debug_mv = 0;//FF_DEBUG_VIS_MV_P_FOR | FF_DEBUG_VIS_MV_B_FOR;
            videoStream = i;
            break;
        }
    }
    if (videoStream == -1)
        return -1; // Didn't find a video stream

    // Get a pointer to the codec context for the video stream
    pCodecCtx = pFormatCtx->streams[videoStream]->codec;
    pCodecCtx->refcounted_frames = 1;
    pCodecCtx->thread_count = 0;//NB_DEC_THREADS;
    //pCodecCtx->thread_type=2;

    // Find the decoder for the video stream
    pCodec = avcodec_find_decoder(pCodecCtx->codec_id);
    if (pCodec == NULL)
        return -1; // Codec not found

    // Inform the codec that we can handle truncated bitstreams -- i.e.,
    // bitstreams where frame boundaries can fall in the middle of packets
    if (pCodec->capabilities & CODEC_CAP_TRUNCATED)
        pCodecCtx->flags |= CODEC_FLAG_TRUNCATED;

    // Open codec
    if (avcodec_open2(pCodecCtx, pCodec, NULL)<0)
        return -1; // Could not open codec

    frameRate_ = 1*pCodecCtx->time_base.den/(pCodecCtx->time_base.num*pCodecCtx->ticks_per_frame);
    width_ = pCodecCtx->width;
    height_ = pCodecCtx->height;
#if RCV
   int rcv_th_id = -1;
   pthread_t rcv_thread;
   rcv_th_data.pFormatCtx = pFormatCtx;
   rcv_th_data.videoStream = videoStream;
   rcv_th_data.b_new_pkt = false;
   rcv_th_data.b_fill_buf = true;
   //rcv_th_data.b_streaming = false;//decode_th_data->b_streaming;
   pthread_mutex_init(&rcv_th_data.new_pkt_mutex,NULL);
   pthread_cond_init(&rcv_th_data.new_pkt_cond,NULL);
   pthread_mutex_init(&rcv_th_data.fill_buff_mutex,NULL);
   pthread_cond_init(&rcv_th_data.fill_buff_cond,NULL);

    rcv_th_id = pthread_create(&rcv_thread,NULL,receive,(void*)&rcv_th_data);
#endif

  return ret;
}
int h264FrameGenerator::GenerateNextFrame(uint8_t* frame_buffer) {
  
//######################### h264framegenerator ##############################################

  AVPacket *packet= nullptr;
 std::queue<AVPacket *> *Pkt_buf = &rcv_th_data.Pkt_buf_;
  
  
#if RCV
  //int size = width_ * height_;
  int  pkt_offset=0;
  int64_t curr_time_stamp = 0;
  int64_t prev_time_stamp = 0;
  { // while time stamp does not change...
        ///////////////// Read packets from receiving thread ///////////////////////
pkt:
        pthread_mutex_lock(&rcv_th_data.fill_buff_mutex);
          if( Pkt_buf->size()>0 ){
            packet=Pkt_buf->front();
            curr_time_stamp = packet->pts;
            if( pkt_offset == 0){
              prev_time_stamp = packet->pts;
            }
            if( curr_time_stamp != prev_time_stamp ){
              pthread_mutex_unlock(&rcv_th_data.fill_buff_mutex);
              //break;
            }
            else{
              Pkt_buf->pop();
              prev_time_stamp = packet->pts;
            }
          }
          else{
            if( b_is_waiting_ ){
               pthread_mutex_unlock(&rcv_th_data.fill_buff_mutex);
               pthread_mutex_lock(&rcv_th_data.new_pkt_mutex);
                 while( rcv_th_data.b_new_pkt == false)
                      pthread_cond_wait(&rcv_th_data.new_pkt_cond, &rcv_th_data.new_pkt_mutex);
                 rcv_th_data.b_new_pkt = false;
               pthread_mutex_unlock(&rcv_th_data.new_pkt_mutex);
               //break;
               goto pkt;
             }
             else{
               pthread_mutex_unlock(&rcv_th_data.fill_buff_mutex);
               return 0;
             }
          }
          if(rcv_th_data.b_streaming == false){
            rcv_th_data.b_fill_buf=true;
            pthread_cond_signal(&rcv_th_data.fill_buff_cond );
          }
        pthread_mutex_unlock(&rcv_th_data.fill_buff_mutex);
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

                memcpy(frame_buffer+pkt_offset, packet->data, packet->size);

        pkt_offset+= packet->size;
        av_packet_unref(packet);

        return pkt_offset+packet->size;


  }
 
#else
        int errr, et ;
        err = GetNextFrame(pFormatCtx, pCodecCtx, videoStream,packet,frame_buffer);
        return 0;//packet->size+4;
#endif
//########################################################################################################

}

}  // namespace cricket
