package com.schedule.b;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.time.Instant;

/**
 * 日程管家 B方案 —— 原生全屏闹钟插件。
 * 调用 AlarmManager 在指定时间触发，届时由 AlarmReceiver 弹出全屏闹钟通知，唤醒 AlarmActivity。
 */
@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        // 安卓 13+ 需要 POST_NOTIFICATIONS 才能显示通知（全屏闹钟依赖通知）
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                getActivity().requestPermissions(new String[]{ Manifest.permission.POST_NOTIFICATIONS }, 100);
            } catch (Exception e) {}
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        int id = call.getInt("id", 0);
        String title = call.getString("title", "日程提醒");
        String body = call.getString("body", "");
        String at = call.getString("at");
        if (id == 0) id = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);

        Context ctx = getContext();
        Intent i = new Intent(ctx, AlarmReceiver.class);
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, id, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);

        long when;
        try { when = Instant.parse(at).toEpochMilli(); }
        catch (Exception e) { when = System.currentTimeMillis() + 60000; }

        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        } catch (Exception e) {
            try { am.set(AlarmManager.RTC_WAKEUP, when, pi); } catch (Exception e2) {}
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        int id = call.getInt("id", 0);
        Context ctx = getContext();
        Intent i = new Intent(ctx, AlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, id, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pi);
        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        call.resolve();
    }
}
