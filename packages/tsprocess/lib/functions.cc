#include <napi.h>
#include <string>
#include <thread>
#include "logger.h"
#include "memory/memory.h"

#if defined(WIN32) || defined(_WIN32)
#include <Windows.h>
#endif

Napi::Value read_byte(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto result = memory::read<int8_t>(handle, address);
  if (!std::get<1>(result)) {
    Napi::TypeError::New(env, logger::format("Couldn't read byte at %x", address)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, std::get<0>(result));
}

Napi::Value read_short(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto result = memory::read<int16_t>(handle, address);
  if (!std::get<1>(result)) {
    Napi::TypeError::New(env, logger::format("Couldn't read short at %x", address)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, std::get<0>(result));
}

Napi::Value read_int(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto result = memory::read<int32_t>(handle, address);
  if (!std::get<1>(result)) {
    Napi::TypeError::New(env, logger::format("Couldn't read int at %x", address)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, std::get<0>(result));
}

Napi::Value read_uint(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto result = memory::read<uint32_t>(handle, address);
  if (!std::get<1>(result)) {
    Napi::TypeError::New(env, logger::format("Couldn't read uint at %x", address)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, std::get<0>(result));
}

Napi::Value read_float(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto result = memory::read<float>(handle, address);
  if (!std::get<1>(result)) {
    Napi::TypeError::New(env, logger::format("Couldn't read float at %x", address)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, std::get<0>(result));
}

Napi::Value read_long(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto result = memory::read<int64_t>(handle, address);
  if (!std::get<1>(result)) {
    Napi::TypeError::New(env, logger::format("Couldn't read long at %x", address)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, std::get<0>(result));
}

Napi::Value read_double(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto result = memory::read<double>(handle, address);
  if (!std::get<1>(result)) {
    Napi::TypeError::New(env, logger::format("Couldn't read double at %x", address)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, std::get<0>(result));
}

Napi::Value scan_sync(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 3) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto signature_buffer = args[1].As<Napi::Uint8Array>();
  auto mask_buffer = args[2].As<Napi::Uint8Array>();

  auto signature = std::vector<uint8_t>(signature_buffer.ByteLength());
  memcpy(signature.data(), signature_buffer.Data(), signature_buffer.ByteLength());

  auto mask = std::vector<uint8_t>(mask_buffer.ByteLength());
  memcpy(mask.data(), mask_buffer.Data(), mask_buffer.ByteLength());

  auto result = memory::find_pattern(handle, signature, mask);

  if (!result) {
    Napi::TypeError::New(env, "Couldn't find signature").ThrowAsJavaScriptException();

    return env.Null();
  }

  return Napi::Number::New(env, result);
}

Napi::Value batch_scan(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto pattern_array = args[1].As<Napi::Array>();

  std::vector<Pattern> patterns;

  for (size_t i = 0; i < pattern_array.Length(); i++) {
    Pattern pattern;

    auto iter_obj = pattern_array.Get(i).As<Napi::Object>();
    auto signature = iter_obj.Get("signature").As<Napi::Uint8Array>();
    auto mask = iter_obj.Get("mask").As<Napi::Uint8Array>();

    pattern.index = i;
    pattern.signature = std::span<uint8_t>(reinterpret_cast<uint8_t *>(signature.Data()), signature.ByteLength());
    pattern.mask = std::span<uint8_t>(reinterpret_cast<uint8_t *>(mask.Data()), mask.ByteLength());
    pattern.found = false;

    patterns.push_back(pattern);
  }

  auto result = memory::batch_find_pattern(handle, patterns);
  auto result_array = Napi::Array::New(env, result.size());

  for (size_t i = 0; i < result.size(); i++) {
    auto obj = Napi::Object::New(env);
    obj.Set("index", Napi::Number::New(env, result[i].index));
    obj.Set("address", Napi::Number::New(env, result[i].address));

    result_array.Set(i, obj);
  }

  return result_array;
}

Napi::Value read_buffer(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 3) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();
  auto size = args[2].As<Napi::Number>().Uint32Value();
  auto buffer = new uint8_t[size];
  auto data = (uint8_t *)malloc(sizeof(uint8_t) * size);
  auto result = memory::read_buffer(handle, address, size, data);

  if (!result) {
    free(data);
    delete[] buffer;
    Napi::TypeError::New(env, logger::format("Couldn't read buffer at %x", address)).ThrowAsJavaScriptException();

    return env.Null();
  }

  auto out = Napi::Buffer<uint8_t>::Copy(env, data, size);
  free(data);
  delete[] buffer;

  return out;
}

static bool scanning = false;

Napi::Value scan(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 4) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto signature = args[1].As<Napi::Uint8Array>();
  auto mask = args[2].As<Napi::Uint8Array>();
  auto callback = Napi::ThreadSafeFunction::New(args.Env(), args[3].As<Napi::Function>(), "tsfn", 0, 1);
  auto signature_data = signature.Data();
  auto signature_length = signature.ByteLength();
  auto mask_data = mask.Data();
  auto mask_length = mask.ByteLength();

  if (!scanning) {
    scanning = true;

    std::thread(
      [handle, signature_data, signature_length, mask_data, mask_length](Napi::ThreadSafeFunction tsfn) {
        auto signature = std::vector<uint8_t>(signature_length);
        memcpy(signature.data(), signature_data, signature_length);

        auto mask = std::vector<uint8_t>(mask_length);
        memcpy(mask.data(), mask_data, mask_length);

        const auto result = memory::find_pattern(handle, signature, mask);
        scanning = false;
        tsfn.BlockingCall([result, tsfn](Napi::Env env, Napi::Function jsCallback) {
          jsCallback.Call({Napi::Number::From(env, result)});
          tsfn.Release();
        });
      },
      callback
    )
      .detach();
  }

  return env.Undefined();
}

Napi::Value find_processes(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto process_name = args[0].As<Napi::String>().Utf8Value();
  auto processes = memory::find_processes(process_name);

  auto arr = Napi::Array::New(env, processes.size());
  for (size_t i = 0; i < processes.size(); i++) {
    arr.Set(i, processes[i]);
  }

  return arr;
}

Napi::Value open_process(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto process_id = args[0].As<Napi::Number>().Int64Value();
  return Napi::Number::New(env, reinterpret_cast<uint64_t>(memory::open_process(process_id)));
}

Napi::Value is_process_exist(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  return Napi::Boolean::New(env, memory::is_process_exist(handle));
}

Napi::Value get_process_path(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  return Napi::String::From(env, memory::get_process_path(handle));
}

Napi::Value get_process_command_line(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  auto handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());

  auto command_line = memory::get_process_command_line(handle);

  return Napi::String::New(env, command_line.c_str());
}

Napi::Value read_csharp_string(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();

  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  void *handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());
  auto address = args[1].As<Napi::Number>().Uint32Value();

  if (address == 0) {
    return Napi::String::New(env, "");
  }

  int string_length;
  if (!memory::read_buffer(
        handle, address + sizeof(int), sizeof(string_length), reinterpret_cast<uint8_t *>(&string_length)
      )) {
#ifdef _WIN32
    auto error_str = logger::format(
      "Couldn't read C# string length (base: %x, length: %x, last error: %d)", address, address + sizeof(int), GetLastError()
    );
#else
    auto error_str = logger::format("Couldn't read C# string length (base: %x)", address);
#endif

    Napi::TypeError::New(env, error_str.c_str()).ThrowAsJavaScriptException();
    return env.Null();
  }

  if (string_length <= 0 || string_length >= 4096) {
    return Napi::String::New(env, "");
  }

  std::vector<wchar_t> string_buffer(string_length);
  if (!memory::read_buffer(
        handle, address + sizeof(int) * 2, string_length * sizeof(wchar_t), reinterpret_cast<uint8_t *>(string_buffer.data())
      )) {
    Napi::TypeError::New(env, "Couldn't read C# string data").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::String::New(env, reinterpret_cast<const char16_t *>(string_buffer.data()), string_length);
}

Napi::Value disable_power_throttling(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() > 0) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }
#if defined(WIN32) || defined(_WIN32)
  if (!SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS)) {
    return Napi::Number::From(env, 0);
  }

  PROCESS_POWER_THROTTLING_STATE state;
  RtlZeroMemory(&state, sizeof(state));
  state.Version = PROCESS_POWER_THROTTLING_CURRENT_VERSION;
  state.ControlMask = PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION;
  state.StateMask = 0;

  SetProcessInformation(GetCurrentProcess(), ProcessPowerThrottling, &state, sizeof(PROCESS_POWER_THROTTLING_STATE));

  using NtQueryTimerResolution_t =
    NTSTATUS(WINAPI *)(PULONG MinimumResolution, PULONG MaximumResolution, PULONG CurrentResolution);
  using NtSetTimerResolution_t =
    NTSTATUS(WINAPI *)(ULONG DesiredResolution, BOOLEAN SetResolution, PULONG CurrentResolution);

  const auto ntdll = GetModuleHandleA("ntdll.dll");
  if (!ntdll) {
    return Napi::Number::From(env, 0);
  }

  const auto nt_query_timer_resolution = (NtQueryTimerResolution_t)GetProcAddress(ntdll, "NtQueryTimerResolution");
  const auto nt_set_timer_resolution = (NtSetTimerResolution_t)GetProcAddress(ntdll, "NtSetTimerResolution");

  if (!nt_query_timer_resolution || !nt_set_timer_resolution) {
    return Napi::Number::From(env, 0);
  }

  ULONG min_res, max_res, curr_res;
  if (nt_query_timer_resolution(&min_res, &max_res, &curr_res) != 0) {
    return Napi::Number::From(env, 0);
  }

  if (nt_set_timer_resolution(max_res, TRUE, &curr_res) != 0) {
    return Napi::Number::From(env, 0);
  }

  return Napi::Number::From(env, curr_res);
#else
  return Napi::Number::From(env, 1);
#endif
}

Napi::Value get_process_cwd(const Napi::CallbackInfo &args) {
  Napi::Env env = args.Env();
  if (args.Length() > 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  void *handle = reinterpret_cast<void *>(args[0].As<Napi::Number>().Int64Value());

  return Napi::Number::From(env, memory::get_process_cwd(handle));
}

Napi::Object init(Napi::Env env, Napi::Object exports) {
  exports["readByte"] = Napi::Function::New(env, read_byte);
  exports["readShort"] = Napi::Function::New(env, read_short);
  exports["readInt"] = Napi::Function::New(env, read_int);
  exports["readUInt"] = Napi::Function::New(env, read_uint);
  exports["readFloat"] = Napi::Function::New(env, read_float);
  exports["readLong"] = Napi::Function::New(env, read_long);
  exports["readDouble"] = Napi::Function::New(env, read_double);
  exports["readBuffer"] = Napi::Function::New(env, read_buffer);
  exports["readCSharpString"] = Napi::Function::New(env, read_csharp_string);
  exports["scanSync"] = Napi::Function::New(env, scan_sync);
  exports["scan"] = Napi::Function::New(env, scan);
  exports["batchScan"] = Napi::Function::New(env, batch_scan);
  exports["openProcess"] = Napi::Function::New(env, open_process);
  exports["findProcesses"] = Napi::Function::New(env, find_processes);
  exports["isProcessExist"] = Napi::Function::New(env, is_process_exist);
  exports["getProcessPath"] = Napi::Function::New(env, get_process_path);
  exports["getProcessCommandLine"] = Napi::Function::New(env, get_process_command_line);
  exports["getProcessCwd"] = Napi::Function::New(env, get_process_cwd);
  exports["disablePowerThrottling"] = Napi::Function::New(env, disable_power_throttling);

  return exports;
}

NODE_API_MODULE(addon, init)
