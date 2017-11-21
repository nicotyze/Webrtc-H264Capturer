/* ---------------------------------------------------------------------------
** This software is in the public domain, furnished "as is", without technical
** support, and with no warranty, express or implied, as to its usefulness for
** any purpose.
**
** h264videocapturer.h
** 
** -------------------------------------------------------------------------*/

#ifndef H264VIDEOCAPTURER_H_
#define H264VIDEOCAPTURER_H_

#include "webrtc/media/base/videocapturer.h"
#include "libyuv/convert.h"
#include "libyuv/planar_functions.h"
#include "libyuv/scale.h"
//#include "webrtc/media/engine/webrtcvideoframefactory.h"
#include "webrtc/examples/peerconnection/client/h264framegenerator.h"
#include "webrtc/examples/peerconnection/client/h264framegenerator.cc"


class RawVideoCapturer : public cricket::VideoCapturer, public rtc::Thread
{
	public:
		RawVideoCapturer(const std::string& in_f_name) : 
				width_(640),
				height_(480), 
				frame_generator_(NULL),
				frame_(NULL)/*,
				frame_index_(0)*/
		{
			LOG(INFO) << "==========================RawVideoCapturer: " << in_f_name ;
			SetCaptureFormat(NULL);
			set_enable_video_adapter(false);
			frame_generator_ = new cricket::h264FrameGenerator();
			frame_generator_->setWaitState( true );

			frame_generator_->SetStreamingMode( (in_f_name.find("://" )!= std::string::npos) || (in_f_name.find(".sdp" )!= std::string::npos)); //if file name contains "://" => enable streaming mode (otherwise it is file mode)
			if( frame_generator_->InitFfmpegSession(in_f_name.c_str())!= 0)
				fprintf(stderr,"########### Problem in FFMPEG initialization...#########");

			//width_ = frame_generator_->getFrameWidth();
			//height_ = frame_generator_->getFrameHeight();
			frameRate_ = frame_generator_->getFrameRate();
			//int size = width_ * height_;
			//int qsize = size / 4;

			frame_data_size_ = 999999;//size + 2 * qsize;
#if 0
			captured_frame_.data = new char[frame_data_size_];
			captured_frame_.fourcc = cricket::FOURCC_IYUV;
			captured_frame_.pixel_height = 1;
			captured_frame_.pixel_width = 1;
			captured_frame_.width = width_;
			captured_frame_.height = height_;
			captured_frame_.data_size = frame_data_size_;
#else
// ?
#endif
			
			std::vector<cricket::VideoFormat> formats;
			formats.push_back(cricket::VideoFormat(width_, height_, cricket::VideoFormat::FpsToInterval(frameRate_), cricket::FOURCC_IYUV));
			SetSupportedFormats(formats);
		}
	  
		virtual ~RawVideoCapturer() 
		{
			Stop();
		}
		

		void SignalFrameCapturedOnStartThread() 
		{

			//SignalFrameCaptured(this, &captured_frame_);

		}
		
		void Run()
		{
			int nalu_size=0;
			rtc::scoped_refptr<webrtc::I420Buffer> buffer(webrtc::I420Buffer::Create(width_, height_));
			// Makes it not all black.
			buffer->InitializeData();
			frame_ = new webrtc::VideoFrame(buffer, webrtc::kVideoRotation_0,10 /* timestamp_us */);

			while(IsRunning())
			{
#if 1
				nalu_size = frame_generator_->GenerateNextFrame((uint8_t*)buffer->DataY()+5);

				uint32_t * p_size;
				p_size = (uint32_t*)buffer->DataY();
				*p_size = nalu_size;
				uint8_t * p_prio;
				p_prio = (uint8_t*)buffer->DataY()+4;
				p_prio[0] = 0x03;
#endif

#if 0
				async_invoker_->AsyncInvoke<void>( RTC_FROM_HERE,
					start_thread_,
					rtc::Bind(&RawVideoCapturer::SignalFrameCapturedOnStartThread, this));
#else
				this->OnFrame(*frame_,width_, height_);
                                //ProcessMessages(1);
#endif
				if( !frame_generator_->isStreamed() ){
				  ProcessMessages(1000./frameRate_);
				}

			}
		}
				
		virtual cricket::CaptureState Start(const cricket::VideoFormat& format) 
		{
			//std::cout << "===========================RawVideoCapturer::Start" << std::endl;
			start_thread_ = rtc::Thread::Current();
			//async_invoker_.reset(new rtc::AsyncInvoker());
			
			SetCaptureFormat(&format);
			SetCaptureState(cricket::CS_RUNNING);
			rtc::Thread::Start();
			return cricket::CS_RUNNING;
		}
	  
		virtual void Stop() 
		{
			rtc::Thread::Stop();
			//async_invoker_.reset();
			SetCaptureFormat(NULL);
			SetCaptureState(cricket::CS_STOPPED);
		}
	  
		virtual bool GetPreferredFourccs(std::vector<unsigned int>* fourccs) 
		{
			fourccs->push_back(cricket::FOURCC_IYUV);
			return true;
		}
	  
		virtual bool IsScreencast() const { return false; };
		virtual bool IsRunning() { return this->capture_state() == cricket::CS_RUNNING; }
	  
	private:
		int width_;
		int height_;
		int frameRate_;
		int frame_data_size_;
		cricket::h264FrameGenerator* frame_generator_;
		//cricket::CapturedFrame captured_frame_;
		webrtc::VideoFrame* frame_;
		rtc::Thread* start_thread_;
		//std::unique_ptr<rtc::AsyncInvoker> async_invoker_;
};



#endif  
